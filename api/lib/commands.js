/**
 * Command handlers — execute business logic for each recognized intent.
 * Each handler receives (msg, params, ctx) and returns nothing (sends WA messages directly).
 *
 * ctx = { db (Firebase Admin database ref), from (phone), vendorId, vendorProfile }
 */
import { sendText, sendButtons, sendList, sendTemplate } from './whatsapp.js';
import { adminDb } from './firebase-admin.js';
import { notifyRiderAssignment } from './rider-commands.js';

// #8: Phone normalization utility
export function normalizePhone(phone) {
    if (!phone) return '';
    let p = phone.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.substring(1);
    // Nigerian numbers: 08x → 2348x
    if (p.match(/^0[789]\d{9}$/)) p = '234' + p.substring(1);
    return p;
}

// ─── Vendor lookup by phone number ──────────────────────────────
// We store a mapping: whatsappUsers/{normalizedPhone} → { vendorId, role }
// This is set during onboarding / first connection.

export async function resolveVendor(phone) {
    const snap = await adminDb.ref(`whatsappUsers/${phone}`).once('value');
    if (!snap.exists()) return null;
    const data = snap.val();

    // Fetch the full vendor profile
    const vendorSnap = await adminDb.ref(`vendors/${data.vendorId}`).once('value');
    return {
        vendorId: data.vendorId,
        role: data.role || 'vendor',
        profile: vendorSnap.val(),
    };
}

// ─── MENU ───────────────────────────────────────────────────────
export async function handleMenu(msg, vendor) {
    if (!vendor) {
        await handleOnboarding(msg);
        return;
    }

    const greeting = msg.name ? `Hey ${msg.name.split(' ')[0]}! 👋` : 'Hey there! 👋';
    await sendButtons(
        msg.from,
        `${greeting}\n\nWhat would you like to do?`,
        [
            { id: 'btn_new_delivery', title: '📦 New Delivery' },
            { id: 'btn_summary', title: '📊 Today\'s Summary' },
            { id: 'btn_my_riders', title: '🛵 My Riders' },
        ],
        'RideWatch',
        'Reply "help" for all commands'
    );
}

// ─── HELP ───────────────────────────────────────────────────────
export async function handleHelp(msg) {
    await sendText(msg.from,
        `🤖 *RideWatch Commands*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📦 *"new delivery"* — Create a delivery\n` +
        `📊 *"summary"* — Today's stats\n` +
        `🛵 *"riders"* — Your rider list\n` +
        `🔍 *"status [ref]"* — Track a delivery\n` +
        `❌ *"cancel [ref]"* — Cancel a delivery\n` +
        `📄 *"export"* — Export delivery history\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Or just type *"menu"* anytime! 🏠`
    );
}

// ─── CREATE DELIVERY (Step 1: Collect info) ─────────────────────
export async function handleCreateDelivery(msg, params, vendor) {
    if (!vendor) {
        await handleOnboarding(msg);
        return;
    }

    // If params already have structured data from free-text parsing
    if (params.destination && params.customerPhone) {
        await executeCreateDelivery(msg.from, vendor, {
            destination: params.destination,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
        });
        return;
    }

    // Otherwise prompt the user for structured input
    await sendText(msg.from,
        `📦 *New Delivery*\n\n` +
        `Send me the details in this format:\n\n` +
        `deliver to [address] for [customer name], [phone]\n\n` +
        `_Example:_\n` +
        `deliver to 15 Bode Thomas, Surulere for Chidi, 08012345678`
    );
}

async function executeCreateDelivery(from, vendor, details) {
    try {
        const sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        const stopCode = Math.floor(1000 + Math.random() * 9000).toString();
        const refId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);

        // Normalize customer phone using utility
        let customerPhone = normalizePhone(details.customerPhone);

        const session = {
            refId,
            stopCode,
            status: 'pending',
            vendorId: vendor.vendorId,
            vendorName: vendor.profile?.businessName || '',
            customerName: details.customerName || '',
            customerPhone: customerPhone,
            destination: details.destination || '',
            createdAt: Date.now(),
            expiresAt: Date.now() + (2 * 60 * 60 * 1000),
            source: 'whatsapp',
        };

        // Save to Firebase
        await adminDb.ref(`sessions/${sessionId}`).set(session);
        await adminDb.ref(`vendors/${vendor.vendorId}/sessions/${sessionId}`).set(session);

        // Also save/update customer record
        const custRef = adminDb.ref('customers').push();
        await custRef.set({
            phone: customerPhone,
            name: details.customerName,
            vendorId: vendor.vendorId,
            createdAt: Date.now(),
        });

        // #6: Clean stale context before setting new
        await adminDb.ref(`whatsappUsers/${from}/pendingSession`).remove();
        await adminDb.ref(`whatsappUsers/${from}/pendingNotify`).remove();

        const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;

        // Send confirmation with rider assignment prompt
        await sendText(from,
            `✅ *Delivery Created!*\n\n` +
            `📦 Ref: *#${refId}*\n` +
            `📍 To: ${details.destination}\n` +
            `👤 Customer: ${details.customerName}\n` +
            `🔑 Stop Code: *${stopCode}*\n` +
            `🔗 Track: ${trackingLink}`
        );

        // Fetch vendor's riders for assignment prompt
        const ridersSnap = await adminDb.ref('riders')
            .orderByChild('vendorId')
            .equalTo(vendor.vendorId)
            .once('value');

        const riders = ridersSnap.val();
        if (riders && Object.keys(riders).length > 0) {
            const rows = Object.entries(riders)
                .filter(([, r]) => r.status === 'active')
                .slice(0, 10)
                .map(([id, r]) => ({
                    id: `assign_rider_${id}_${sessionId}`,
                    title: r.name || r.phone || id,
                    description: `${r.totalDeliveries || 0} deliveries`,
                }));

            if (rows.length > 0) {
                await sendList(
                    from,
                    `🛵 Assign a rider to this delivery:`,
                    'Pick Rider',
                    [{ title: 'Available Riders', rows }],
                    null,
                    'Or reply "skip" to assign later'
                );
            }
        } else {
            await sendButtons(from,
                `You don't have any riders yet. Add riders in your vendor dashboard.`,
                [{ id: 'btn_menu', title: '🏠 Menu' }]
            );
        }

        // Store pending session for context
        await adminDb.ref(`whatsappUsers/${from}/pendingSession`).set(sessionId);

    } catch (err) {
        console.error('[CMD] createDelivery error:', err);
        await sendText(from, `❌ Failed to create delivery. Please try again.`);
    }
}


// ─── ASSIGN RIDER ───────────────────────────────────────────────
export async function handleAssignRider(msg, params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    // List reply ID format: "assign_rider_{riderId}_{sessionId}"
    const parts = params.riderId?.split('_') || [];
    // riderId could itself contain underscores from Firebase push IDs
    // Format: assign_rider_{pushId}_{sess_xxx}
    // We need to find the last sess_ part
    const fullId = params.riderId || '';
    const sessIdx = fullId.lastIndexOf('_sess_');

    if (sessIdx === -1) {
        await sendText(msg.from, `❌ Could not determine which delivery to assign. Try again from the delivery creation flow.`);
        return;
    }

    const riderId = fullId.substring(0, sessIdx);
    const sessionId = fullId.substring(sessIdx + 1); // includes 'sess_...'

    try {
        // #7: Validate session still exists and is actionable
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session) {
            await sendText(msg.from, `❌ This delivery no longer exists. It may have been cancelled or completed.`);
            return;
        }
        if (session.status === 'completed' || session.status === 'cancelled') {
            await sendText(msg.from, `❌ This delivery is already *${session.status}*. Start a new delivery instead.`);
            await sendButtons(msg.from, 'What next?', [{ id: 'btn_new_delivery', title: '📦 New Delivery' }, { id: 'btn_menu', title: '🏠 Menu' }]);
            return;
        }

        // Get rider info
        const riderSnap = await adminDb.ref(`riders/${riderId}`).once('value');
        const rider = riderSnap.val();
        if (!rider) {
            await sendText(msg.from, `❌ Rider not found.`);
            return;
        }

        // #11: Use transaction for concurrent-safe rider assignment
        const updates = {};
        updates[`sessions/${sessionId}/riderId`] = riderId;
        updates[`sessions/${sessionId}/riderName`] = rider.name || '';
        updates[`sessions/${sessionId}/riderPhone`] = rider.phone || '';
        updates[`sessions/${sessionId}/status`] = 'assigned';
        updates[`vendors/${vendor.vendorId}/sessions/${sessionId}/riderId`] = riderId;
        updates[`vendors/${vendor.vendorId}/sessions/${sessionId}/riderName`] = rider.name || '';
        updates[`vendors/${vendor.vendorId}/sessions/${sessionId}/riderPhone`] = rider.phone || '';
        updates[`vendors/${vendor.vendorId}/sessions/${sessionId}/status`] = 'assigned';
        await adminDb.ref().update(updates);

        const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;

        await sendText(msg.from,
            `✅ *Rider Assigned!*\n\n` +
            `🛵 ${rider.name} has been assigned.\n` +
            `📱 Rider phone: ${rider.phone || 'N/A'}`
        );

        // Notify rider via WhatsApp
        if (rider.phone) {
            const riderPhone = normalizePhone(rider.phone);
            await notifyRiderAssignment(riderPhone, session, sessionId);
        }

        // Ask if they want to notify the customer
        if (session.customerPhone) {
            await sendButtons(msg.from,
                `📲 Send tracking link to the customer (${session.customerName || session.customerPhone})?`,
                [
                    { id: `btn_send_customer`, title: '✅ Yes, Send' },
                    { id: 'btn_menu', title: '🏠 Menu' },
                ]
            );
            // Store context for the follow-up
            await adminDb.ref(`whatsappUsers/${msg.from}/pendingNotify`).set({
                sessionId,
                customerPhone: session.customerPhone,
                customerName: session.customerName,
                riderName: rider.name,
                trackingLink,
                refId: session.refId,
            });
        }

    } catch (err) {
        console.error('[CMD] assignRider error:', err);
        await sendText(msg.from, `❌ Failed to assign rider. Please try again.`);
    }
}

// ─── SEND TO CUSTOMER (notify customer with tracking link) ──────
export async function handleSendToCustomer(msg, _params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    try {
        const notifySnap = await adminDb.ref(`whatsappUsers/${msg.from}/pendingNotify`).once('value');
        const ctx = notifySnap.val();

        if (!ctx) {
            await sendText(msg.from, `No pending delivery to notify about. Create a new delivery first!`);
            return;
        }

        const businessName = vendor.profile?.businessName || 'Your Vendor';
        const customerName = ctx.customerName || 'there';
        const trackingMessage =
            `📦 *${businessName}*\n\n` +
            `Hi ${customerName}! Your delivery *#${ctx.refId}* is on the way.\n` +
            `🛵 Rider: ${ctx.riderName}\n\n` +
            `📍 Track live: ${ctx.trackingLink}\n\n` +
            `_Powered by RideWatch_`;

        // Try sending as a regular text message first
        const result = await sendText(ctx.customerPhone, trackingMessage);

        // Check if it failed due to 24hr messaging window restriction
        const errorCode = result?.error?.code;
        const errorSubCode = result?.error?.error_subcode;
        const isWindowError = result?.error && (
            errorCode === 131047 || errorSubCode === 131047 ||
            errorCode === 131026 || errorSubCode === 131026
        );

        if (isWindowError) {
            console.log(`[CMD] Outside 24hr window for ${ctx.customerPhone}, using template...`);

            // Fall back to the approved template message
            const templateResult = await sendTemplate(ctx.customerPhone, 'delivery_update', 'en', [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: customerName },
                        { type: 'text', text: ctx.refId },
                        { type: 'text', text: ctx.riderName || 'your rider' },
                        { type: 'text', text: ctx.trackingLink },
                    ],
                },
            ]);

            if (templateResult?.error) {
                console.error('[CMD] Template also failed:', JSON.stringify(templateResult));
                await sendText(msg.from,
                    `⚠️ Could not reach ${ctx.customerName || ctx.customerPhone} on WhatsApp.\n\n` +
                    `This happens when the customer hasn't messaged RideWatch Bot before.\n\n` +
                    `📋 Share this link manually:\n${ctx.trackingLink}`
                );
                return;
            }
        } else if (result?.error) {
            // Some other error
            console.error('[CMD] sendToCustomer unexpected error:', JSON.stringify(result));
            await sendText(msg.from,
                `⚠️ Could not send to ${ctx.customerName || ctx.customerPhone}.\n\n` +
                `📋 Share this link manually:\n${ctx.trackingLink}`
            );
            return;
        }

        await sendText(msg.from, `✅ Tracking link sent to ${ctx.customerName || ctx.customerPhone}!`);

        // Clean up context
        await adminDb.ref(`whatsappUsers/${msg.from}/pendingNotify`).remove();

    } catch (err) {
        console.error('[CMD] sendToCustomer error:', err);
        await sendText(msg.from, `❌ Failed to notify customer. You can share the link manually.`);
    }
}

// ─── CHECK STATUS ───────────────────────────────────────────────
export async function handleCheckStatus(msg, params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    try {
        let session = null;
        let sessionId = params.sessionId;

        // If ref ID was provided, search by refId
        if (params.refId) {
            const sessionsSnap = await adminDb.ref('sessions')
                .orderByChild('vendorId')
                .equalTo(vendor.vendorId)
                .once('value');

            const sessions = sessionsSnap.val() || {};
            for (const [id, s] of Object.entries(sessions)) {
                if (s.refId?.toLowerCase() === params.refId.toLowerCase() ||
                    s.refId?.toLowerCase() === `ord-${params.refId.toLowerCase()}`) {
                    session = s;
                    sessionId = id;
                    break;
                }
            }
        } else if (sessionId) {
            const snap = await adminDb.ref(`sessions/${sessionId}`).once('value');
            session = snap.val();
        }

        if (!session) {
            // Show recent active deliveries as a list
            const sessionsSnap = await adminDb.ref('sessions')
                .orderByChild('vendorId')
                .equalTo(vendor.vendorId)
                .once('value');

            const sessions = sessionsSnap.val() || {};
            const active = Object.entries(sessions)
                .filter(([, s]) => s.status !== 'completed' && s.status !== 'cancelled')
                .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
                .slice(0, 10);

            if (active.length === 0) {
                await sendText(msg.from, `📭 No active deliveries right now.`);
                return;
            }

            const rows = active.map(([id, s]) => ({
                id: `status_${id}`,
                title: `#${s.refId || id.substring(0, 10)}`,
                description: `${statusEmoji(s.status)} ${s.riderName || 'Unassigned'} → ${(s.destination || '').substring(0, 40)}`,
            }));

            await sendList(msg.from,
                `🔍 Which delivery would you like to check?`,
                'Select Delivery',
                [{ title: 'Active Deliveries', rows }]
            );
            return;
        }

        // Show status details
        const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;
        await sendText(msg.from,
            `📦 *Delivery #${session.refId}*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `${statusEmoji(session.status)} Status: *${session.status?.toUpperCase()}*\n` +
            `🛵 Rider: ${session.riderName || 'Not assigned'}\n` +
            `📍 To: ${session.destination || 'N/A'}\n` +
            `👤 Customer: ${session.customerName || 'N/A'}\n` +
            `🔑 Stop Code: *${session.stopCode}*\n` +
            `🔗 Track: ${trackingLink}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `🕐 Created: ${timeAgo(session.createdAt)}`
        );

    } catch (err) {
        console.error('[CMD] checkStatus error:', err);
        await sendText(msg.from, `❌ Failed to check status. Try again.`);
    }
}

// ─── DAILY SUMMARY ──────────────────────────────────────────────
export async function handleDailySummary(msg, _params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    try {
        const sessionsSnap = await adminDb.ref('sessions')
            .orderByChild('vendorId')
            .equalTo(vendor.vendorId)
            .once('value');

        const sessions = sessionsSnap.val() || {};
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        let completed = 0, inTransit = 0, pending = 0, cancelled = 0, assigned = 0;
        const riderCounts = {};

        for (const s of Object.values(sessions)) {
            if ((s.createdAt || 0) < todayMs) continue; // Only today's

            switch (s.status) {
                case 'completed': completed++; break;
                case 'active':
                case 'in_transit': inTransit++; break;
                case 'pending': pending++; break;
                case 'assigned': assigned++; break;
                case 'cancelled': cancelled++; break;
            }

            if (s.riderName) {
                riderCounts[s.riderName] = (riderCounts[s.riderName] || 0) + 1;
            }
        }

        const total = completed + inTransit + pending + cancelled + assigned;
        const topRider = Object.entries(riderCounts).sort((a, b) => b[1] - a[1])[0];

        await sendText(msg.from,
            `📊 *Today's Summary*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `✅ Completed: ${completed}\n` +
            `🚚 In Transit: ${inTransit}\n` +
            `📋 Assigned: ${assigned}\n` +
            `⏳ Pending: ${pending}\n` +
            `❌ Cancelled: ${cancelled}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📈 Total: ${total}\n` +
            (topRider ? `🔥 Top Rider: ${topRider[0]} (${topRider[1]} deliveries)\n` : '') +
            `━━━━━━━━━━━━━━━`
        );

        await sendButtons(msg.from,
            `What's next?`,
            [
                { id: 'btn_new_delivery', title: '📦 New Delivery' },
                { id: 'btn_check_status', title: '🔍 Check Status' },
                { id: 'btn_menu', title: '🏠 Menu' },
            ]
        );

    } catch (err) {
        console.error('[CMD] dailySummary error:', err);
        await sendText(msg.from, `❌ Failed to load summary. Try again.`);
    }
}

// ─── LIST RIDERS ────────────────────────────────────────────────
export async function handleListRiders(msg, _params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    try {
        const ridersSnap = await adminDb.ref('riders')
            .orderByChild('vendorId')
            .equalTo(vendor.vendorId)
            .once('value');

        const riders = ridersSnap.val();
        if (!riders || Object.keys(riders).length === 0) {
            await sendText(msg.from,
                `🛵 You don't have any riders yet.\n\n` +
                `Add riders from your vendor dashboard:\n` +
                `https://ridewatchapp.com/vendor`
            );
            return;
        }

        let riderList = `🛵 *Your Riders*\n━━━━━━━━━━━━━━━\n`;
        for (const [, r] of Object.entries(riders)) {
            const statusIcon = r.status === 'active' ? '🟢' : '🔴';
            riderList += `${statusIcon} *${r.name}* — ${r.phone || 'No phone'}\n`;
            riderList += `   📦 ${r.totalDeliveries || 0} deliveries\n\n`;
        }

        await sendText(msg.from, riderList);

    } catch (err) {
        console.error('[CMD] listRiders error:', err);
        await sendText(msg.from, `❌ Failed to load riders. Try again.`);
    }
}

// ─── CANCEL DELIVERY ────────────────────────────────────────────
export async function handleCancelDelivery(msg, params, vendor) {
    if (!vendor) { await handleOnboarding(msg); return; }

    const sessionId = params.sessionId;
    if (!sessionId) {
        // Show active deliveries for selection
        await handleCheckStatus(msg, {}, vendor);
        return;
    }

    try {
        await adminDb.ref(`sessions/${sessionId}`).update({
            status: 'cancelled',
            cancelledAt: Date.now(),
            cancelledBy: 'whatsapp',
        });

        await adminDb.ref(`vendors/${vendor.vendorId}/sessions/${sessionId}`).update({
            status: 'cancelled',
            cancelledAt: Date.now(),
        });

        await sendText(msg.from, `❌ Delivery cancelled successfully.`);
        await sendButtons(msg.from,
            `What's next?`,
            [
                { id: 'btn_new_delivery', title: '📦 New Delivery' },
                { id: 'btn_menu', title: '🏠 Menu' },
            ]
        );

    } catch (err) {
        console.error('[CMD] cancelDelivery error:', err);
        await sendText(msg.from, `❌ Failed to cancel delivery.`);
    }
}

// ─── ONBOARDING (link WhatsApp to vendor account) ───────────────
export async function handleOnboarding(msg) {
    const code = generateLinkCode(msg.from);

    // Store pending link so the vendor dashboard can verify it
    await adminDb.ref(`pendingLinks/${code}`).set({
        phone: msg.from,
        createdAt: Date.now(),
        expiresAt: Date.now() + (30 * 60 * 1000), // 30 min expiry
    });

    await sendText(msg.from,
        `👋 *Welcome to RideWatch!*\n\n` +
        `To use RideWatch on WhatsApp, you need to connect your vendor account.\n\n` +
        `1️⃣ Go to your vendor dashboard:\n` +
        `   https://ridewatchapp.com/vendor\n\n` +
        `2️⃣ In Settings → WhatsApp, enter this code:\n` +
        `   *${code}*\n\n` +
        `⏱️ Code expires in 30 minutes.\n` +
        `Once linked, you can manage everything from here! 🚀`
    );
}

// ─── UNKNOWN ────────────────────────────────────────────────────
export async function handleUnknown(msg) {
    await sendButtons(msg.from,
        `🤔 I didn't quite get that. Here's what I can help with:`,
        [
            { id: 'btn_new_delivery', title: '📦 New Delivery' },
            { id: 'btn_summary', title: '📊 Summary' },
            { id: 'btn_help', title: '❓ All Commands' },
        ],
        'RideWatch'
    );
}

// ─── HELPERS ────────────────────────────────────────────────────

function statusEmoji(status) {
    const map = {
        pending: '⏳',
        assigned: '📋',
        active: '🚚',
        in_transit: '🚚',
        completed: '✅',
        cancelled: '❌',
    };
    return map[status] || '❓';
}

function timeAgo(ts) {
    if (!ts) return 'Unknown';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function generateLinkCode() {
    // Random 6-char alphanumeric code — stored in pendingLinks for verification
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
