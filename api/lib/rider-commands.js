/**
 * Rider command handlers — WhatsApp interactions for delivery riders.
 *
 * Riders are identified by matching their phone number against the `riders` table.
 * No onboarding code needed — vendors add rider phone numbers in the dashboard.
 */
import { sendText, sendButtons, sendList } from './whatsapp.js';
import { adminDb } from './firebase-admin.js';

// Phone normalization (duplicated from commands.js to avoid circular import)
function normalizePhone(phone) {
    if (!phone) return '';
    let p = phone.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.substring(1);
    if (p.match(/^0[789]\d{9}$/)) p = '234' + p.substring(1);
    return p;
}

// ─── Rider lookup by phone number ───────────────────────────────
// Tries multiple phone formats since vendors may store numbers differently
export async function resolveRider(phone) {
    // Build variants: 2348012345678 → also try 08012345678, +2348012345678
    const variants = [phone];
    if (phone.startsWith('234')) {
        variants.push('0' + phone.substring(3));       // 2348012345678 → 08012345678
        variants.push('+' + phone);                     // 2348012345678 → +2348012345678
    } else if (phone.startsWith('0')) {
        variants.push('234' + phone.substring(1));      // 08012345678 → 2348012345678
        variants.push('+234' + phone.substring(1));     // 08012345678 → +2348012345678
    }

    for (const variant of variants) {
        const ridersSnap = await adminDb.ref('riders')
            .orderByChild('phone')
            .equalTo(variant)
            .limitToFirst(1)
            .once('value');

        const riders = ridersSnap.val();
        if (riders) {
            const [riderId, rider] = Object.entries(riders)[0];
            return { riderId, ...rider };
        }
    }

    return null;
}

// ─── RIDER MENU ─────────────────────────────────────────────────
export async function handleRiderMenu(msg, rider) {
    const greeting = msg.name ? `Hey ${msg.name.split(' ')[0]}! 🛵` : 'Hey rider! 🛵';

    // Find active deliveries assigned to this rider
    const sessionsSnap = await adminDb.ref('sessions')
        .orderByChild('riderId')
        .equalTo(rider.riderId)
        .once('value');

    const sessions = sessionsSnap.val() || {};
    const active = Object.entries(sessions)
        .filter(([, s]) => s.status !== 'completed' && s.status !== 'cancelled')
        .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    if (active.length === 0) {
        await sendText(msg.from,
            `${greeting}\n\n` +
            `📭 No active deliveries right now.\n` +
            `You'll get a notification when a new delivery is assigned to you!`
        );
        return;
    }

    if (active.length === 1) {
        // Single active delivery — show details directly
        await showRiderDeliveryDetails(msg.from, active[0][0], active[0][1]);
        return;
    }

    // Multiple active deliveries — show as list
    const rows = active.slice(0, 10).map(([id, s]) => ({
        id: `rider_status_${id}`,
        title: `#${s.refId || id.substring(0, 10)}`,
        description: `${statusEmoji(s.status)} ${s.status} → ${(s.destination || '').substring(0, 40)}`,
    }));

    await sendList(msg.from,
        `${greeting}\n\nYou have *${active.length}* active deliveries:`,
        'View Delivery',
        [{ title: 'Your Deliveries', rows }]
    );
}

// ─── SHOW DELIVERY DETAILS (for rider) ──────────────────────────
async function showRiderDeliveryDetails(to, sessionId, session) {
    const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;
    const mapsLink = session.destination
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.destination)}`
        : null;

    await sendText(to,
        `📦 *Delivery #${session.refId}*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `${statusEmoji(session.status)} Status: *${session.status?.toUpperCase()}*\n` +
        `📍 To: ${session.destination || 'N/A'}\n` +
        `👤 Customer: ${session.customerName || 'N/A'}\n` +
        `📱 Customer phone: ${session.customerPhone || 'N/A'}\n` +
        `🏪 Vendor: ${session.vendorName || 'N/A'}\n` +
        `🔑 Stop Code: *${session.stopCode}*\n` +
        (mapsLink ? `🗺️ Navigate: ${mapsLink}\n` : '') +
        `🔗 Track: ${trackingLink}\n` +
        `━━━━━━━━━━━━━━━`
    );

    // Show appropriate action buttons based on current status
    const buttons = getNextStatusButtons(session.status, sessionId);
    if (buttons.length > 0) {
        await sendButtons(to, `What's the update?`, buttons);
    }
}

// ─── RIDER ACCEPTS ASSIGNMENT ───────────────────────────────────
export async function handleRiderAccept(msg, params, rider) {
    const sessionId = params.sessionId || params.buttonId?.replace('btn_rider_accept_', '');
    if (!sessionId) {
        await handleRiderMenu(msg, rider);
        return;
    }

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session || session.riderId !== rider.riderId) {
            await sendText(msg.from, `❌ This delivery isn't assigned to you.`);
            return;
        }

        // Update status to active (rider accepted)
        const updates = {};
        updates[`sessions/${sessionId}/status`] = 'active';
        updates[`sessions/${sessionId}/riderAcceptedAt`] = Date.now();
        if (session.vendorId) {
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/status`] = 'active';
        }
        await adminDb.ref().update(updates);

        const mapsLink = session.destination
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.destination)}`
            : null;

        await sendText(msg.from,
            `✅ *Assignment Accepted!*\n\n` +
            `📦 #${session.refId}\n` +
            `📍 ${session.destination}\n` +
            `👤 ${session.customerName || 'Customer'}: ${session.customerPhone || ''}\n` +
            (mapsLink ? `🗺️ Navigate: ${mapsLink}\n\n` : '\n') +
            `When you've picked up the package, tap *"Picked Up"* below.`
        );

        await sendButtons(msg.from, `Update delivery status:`, [
            { id: `btn_rider_pickup`, title: '📤 Picked Up' },
            { id: `btn_rider_reject`, title: '❌ Can\'t Do This' },
        ]);

        // Store active session for context
        await adminDb.ref(`riderContext/${msg.from}/activeSession`).set(sessionId);

        // Notify vendor
        await notifyVendor(session.vendorId, session,
            `🛵 *${rider.name || 'Your rider'}* accepted delivery #${session.refId}!`
        );

    } catch (err) {
        console.error('[RIDER] accept error:', err);
        await sendText(msg.from, `❌ Failed to accept. Try again.`);
    }
}

// ─── RIDER REJECTS ASSIGNMENT ───────────────────────────────────
export async function handleRiderReject(msg, params, rider) {
    const sessionId = params.sessionId || await getActiveSession(msg.from);
    if (!sessionId) {
        await sendText(msg.from, `No active delivery to reject.`);
        return;
    }

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session) return;

        // Unassign rider — set back to pending
        const updates = {};
        updates[`sessions/${sessionId}/riderId`] = null;
        updates[`sessions/${sessionId}/riderName`] = null;
        updates[`sessions/${sessionId}/riderPhone`] = null;
        updates[`sessions/${sessionId}/status`] = 'pending';
        if (session.vendorId) {
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/riderId`] = null;
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/riderName`] = null;
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/riderPhone`] = null;
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/status`] = 'pending';
        }
        await adminDb.ref().update(updates);

        // Clean rider context
        await adminDb.ref(`riderContext/${msg.from}/activeSession`).remove();

        await sendText(msg.from, `✅ No worries! Delivery #${session.refId} has been released.`);

        // Notify vendor
        await notifyVendor(session.vendorId, session,
            `⚠️ *${rider.name || 'Rider'}* declined delivery #${session.refId}. Please reassign.`
        );

    } catch (err) {
        console.error('[RIDER] reject error:', err);
        await sendText(msg.from, `❌ Failed to reject. Try again.`);
    }
}

// ─── RIDER STATUS UPDATES (Picked Up → In Transit → Arrived) ───
export async function handleRiderStatusUpdate(msg, params, rider, newStatus) {
    const sessionId = params.sessionId || await getActiveSession(msg.from);
    if (!sessionId) {
        await sendText(msg.from, `No active delivery. Type "menu" to see your deliveries.`);
        return;
    }

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session || session.riderId !== rider.riderId) {
            await sendText(msg.from, `❌ This delivery isn't assigned to you.`);
            return;
        }

        const statusLabels = {
            'picked_up': 'Picked Up',
            'in_transit': 'In Transit',
            'arrived': 'Arrived',
        };

        const updates = {};
        updates[`sessions/${sessionId}/status`] = newStatus;
        updates[`sessions/${sessionId}/${newStatus}At`] = Date.now();
        if (session.vendorId) {
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/status`] = newStatus;
        }
        await adminDb.ref().update(updates);

        await sendText(msg.from,
            `${statusEmoji(newStatus)} *Status Updated: ${statusLabels[newStatus] || newStatus}*\n\n` +
            `📦 Delivery #${session.refId}`
        );

        // Show next action buttons
        const buttons = getNextStatusButtons(newStatus, sessionId);
        if (buttons.length > 0) {
            await sendButtons(msg.from, `Next step:`, buttons);
        }

        // Notify vendor
        await notifyVendor(session.vendorId, session,
            `${statusEmoji(newStatus)} Delivery #${session.refId} is now *${statusLabels[newStatus]}*\n🛵 Rider: ${rider.name || 'Rider'}`
        );

    } catch (err) {
        console.error('[RIDER] statusUpdate error:', err);
        await sendText(msg.from, `❌ Failed to update status. Try again.`);
    }
}

// ─── RIDER ENTERS STOP CODE → COMPLETE DELIVERY ────────────────
export async function handleRiderStopCode(msg, params, rider) {
    const sessionId = await getActiveSession(msg.from);
    if (!sessionId) {
        await sendText(msg.from, `No active delivery. That code doesn't match anything.`);
        return;
    }

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session) return;

        if (session.stopCode !== params.stopCode) {
            await sendText(msg.from,
                `❌ Wrong stop code. Ask the customer for the correct 4-digit code.\n` +
                `_Hint: It was sent to the customer in their tracking link._`
            );
            return;
        }

        // Mark delivery as completed!
        const updates = {};
        updates[`sessions/${sessionId}/status`] = 'completed';
        updates[`sessions/${sessionId}/completedAt`] = Date.now();
        updates[`sessions/${sessionId}/completedBy`] = 'rider_whatsapp';
        if (session.vendorId) {
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/status`] = 'completed';
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/completedAt`] = Date.now();
        }
        // Increment rider's delivery count
        const riderDeliveries = (rider.totalDeliveries || 0) + 1;
        updates[`riders/${rider.riderId}/totalDeliveries`] = riderDeliveries;
        await adminDb.ref().update(updates);

        // Clean rider context
        await adminDb.ref(`riderContext/${msg.from}/activeSession`).remove();

        await sendText(msg.from,
            `🎉 *Delivery Completed!*\n\n` +
            `📦 #${session.refId} — delivered to ${session.customerName || 'customer'}\n` +
            `✅ Stop code verified\n` +
            `📊 Total deliveries: ${riderDeliveries}\n\n` +
            `Great job! 💪`
        );

        // Notify vendor
        await notifyVendor(session.vendorId, session,
            `✅ Delivery #${session.refId} *COMPLETED*!\n` +
            `🛵 ${rider.name || 'Rider'} delivered to ${session.customerName || 'customer'}\n` +
            `🔑 Stop code verified`
        );

        // Notify customer
        if (session.customerPhone) {
            await sendText(session.customerPhone,
                `✅ *Delivery Complete!*\n\n` +
                `Your package from *${session.vendorName || 'your vendor'}* has been delivered.\n` +
                `Thank you for using RideWatch! 🙏`
            );
        }

    } catch (err) {
        console.error('[RIDER] stopCode error:', err);
        await sendText(msg.from, `❌ Failed to verify code. Try again.`);
    }
}

// ─── RIDER VIEW SPECIFIC DELIVERY ───────────────────────────────
export async function handleRiderViewDelivery(msg, params, rider) {
    const sessionId = params.sessionId;
    if (!sessionId) {
        await handleRiderMenu(msg, rider);
        return;
    }

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session || session.riderId !== rider.riderId) {
            await sendText(msg.from, `❌ This delivery isn't assigned to you.`);
            return;
        }

        await showRiderDeliveryDetails(msg.from, sessionId, session);
        await adminDb.ref(`riderContext/${msg.from}/activeSession`).set(sessionId);

    } catch (err) {
        console.error('[RIDER] viewDelivery error:', err);
        await sendText(msg.from, `❌ Failed to load delivery. Try again.`);
    }
}

// ─── NOTIFY RIDER ON ASSIGNMENT (called from vendor flow) ───────
export async function notifyRiderAssignment(riderPhone, session, sessionId) {
    try {
        const mapsLink = session.destination
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.destination)}`
            : null;

        await sendText(riderPhone,
            `📦 *New Delivery Assignment!*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `🏪 From: ${session.vendorName || 'Vendor'}\n` +
            `📍 To: ${session.destination || 'N/A'}\n` +
            `👤 Customer: ${session.customerName || 'N/A'}\n` +
            `📱 Phone: ${session.customerPhone || 'N/A'}\n` +
            `🔑 Stop Code: *${session.stopCode}*\n` +
            (mapsLink ? `🗺️ Navigate: ${mapsLink}\n` : '') +
            `━━━━━━━━━━━━━━━`
        );

        await sendButtons(riderPhone,
            `Accept this delivery?`,
            [
                { id: `btn_rider_accept`, title: '✅ Accept' },
                { id: `btn_rider_reject`, title: '❌ Decline' },
            ]
        );

        // Store context for the rider
        await adminDb.ref(`riderContext/${riderPhone}/activeSession`).set(sessionId);

    } catch (err) {
        console.error('[RIDER] notifyAssignment error:', err);
        // Don't throw — assignment still succeeded even if notification fails
    }
}

// ─── HELPERS ────────────────────────────────────────────────────

async function getActiveSession(phone) {
    const snap = await adminDb.ref(`riderContext/${phone}/activeSession`).once('value');
    return snap.val();
}

function getNextStatusButtons(status, sessionId) {
    switch (status) {
        case 'assigned':
            return [
                { id: 'btn_rider_accept', title: '✅ Accept' },
                { id: 'btn_rider_reject', title: '❌ Decline' },
            ];
        case 'active':
            return [
                { id: 'btn_rider_pickup', title: '📤 Picked Up' },
            ];
        case 'picked_up':
            return [
                { id: 'btn_rider_intransit', title: '🚚 In Transit' },
            ];
        case 'in_transit':
            return [
                { id: 'btn_rider_arrived', title: '📍 Arrived' },
            ];
        case 'arrived':
            return []; // Rider needs to enter stop code — no button
        default:
            return [];
    }
}

async function notifyVendor(vendorId, session, message) {
    try {
        if (!vendorId) return;
        // Look up vendor's WhatsApp number
        const vendorSnap = await adminDb.ref(`vendors/${vendorId}`).once('value');
        const vendor = vendorSnap.val();
        if (vendor?.whatsappPhone) {
            await sendText(vendor.whatsappPhone, message);
        }
    } catch (err) {
        console.error('[RIDER] notifyVendor error:', err);
    }
}

function statusEmoji(status) {
    const map = {
        pending: '⏳', assigned: '📋', active: '🟢',
        picked_up: '📤', in_transit: '🚚', arrived: '📍',
        completed: '✅', cancelled: '❌',
    };
    return map[status] || '❓';
}
