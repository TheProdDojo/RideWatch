/**
 * Customer command handlers — WhatsApp interactions for delivery recipients.
 *
 * Customers are identified by matching their phone number against customerPhone
 * in the sessions table. No onboarding needed.
 */
import { sendText, sendButtons } from './whatsapp.js';
import { adminDb } from './firebase-admin.js';

// ─── Customer lookup ────────────────────────────────────────────
// Returns active deliveries for this customer phone
export async function resolveCustomer(phone) {
    // Try exact match first
    const sessionsSnap = await adminDb.ref('sessions')
        .orderByChild('customerPhone')
        .equalTo(phone)
        .once('value');

    const sessions = sessionsSnap.val();
    if (!sessions) return null;

    // #6: Filter out expired sessions (>48h old, not completed/cancelled)
    const MAX_SESSION_AGE = 48 * 60 * 60 * 1000; // 48 hours
    const now = Date.now();

    const active = Object.entries(sessions)
        .filter(([, s]) => {
            if (s.status === 'completed' || s.status === 'cancelled') return false;
            // Expire sessions older than 48h that are still pending
            if (s.createdAt && (now - s.createdAt) > MAX_SESSION_AGE && s.status === 'pending') return false;
            return true;
        })
        .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    const recent = Object.entries(sessions)
        .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    return {
        phone,
        activeDeliveries: active,
        recentDeliveries: recent.slice(0, 5),
        isCustomer: true,
    };
}

// ─── CUSTOMER STATUS (show their deliveries) ────────────────────
export async function handleCustomerStatus(msg, customer) {
    const { activeDeliveries, recentDeliveries } = customer;

    if (activeDeliveries.length === 0) {
        // No active — show most recent completed
        if (recentDeliveries.length > 0) {
            const [sessionId, session] = recentDeliveries[0];
            const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;
            await sendText(msg.from,
                `📦 Hi${session.customerName ? ' ' + session.customerName : ''}!\n\n` +
                `Your last delivery from *${session.vendorName || 'your vendor'}*:\n` +
                `${statusEmoji(session.status)} Status: *${session.status?.toUpperCase()}*\n` +
                `🔗 Details: ${trackingLink}\n\n` +
                `_No active deliveries right now._`
            );
        } else {
            await sendText(msg.from,
                `📦 No deliveries found for your number.\n` +
                `If you're expecting a package, contact your vendor!`
            );
        }
        return;
    }

    if (activeDeliveries.length === 1) {
        // Single active delivery — show full details
        const [sessionId, session] = activeDeliveries[0];
        await showCustomerDeliveryDetails(msg.from, sessionId, session);
        return;
    }

    // Multiple active deliveries
    let text = `📦 You have *${activeDeliveries.length}* active deliveries:\n━━━━━━━━━━━━━━━\n\n`;
    for (const [sessionId, session] of activeDeliveries.slice(0, 5)) {
        const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;
        text += `${statusEmoji(session.status)} *#${session.refId}* from ${session.vendorName || 'vendor'}\n`;
        text += `   Status: ${session.status?.toUpperCase()}\n`;
        text += `   ${session.riderName ? `🛵 Rider: ${session.riderName}` : '⏳ Rider not assigned yet'}\n`;
        text += `   🔗 ${trackingLink}\n\n`;
    }
    await sendText(msg.from, text);
}

// ─── SHOW DELIVERY DETAILS (for customer) ───────────────────────
async function showCustomerDeliveryDetails(to, sessionId, session) {
    const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;

    await sendText(to,
        `📦 *Delivery #${session.refId}*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🏪 From: *${session.vendorName || 'Vendor'}*\n` +
        `${statusEmoji(session.status)} Status: *${formatStatus(session.status)}*\n` +
        (session.riderName ? `🛵 Rider: ${session.riderName}\n` : '⏳ Rider not assigned yet\n') +
        `📍 Delivering to: ${session.destination || 'N/A'}\n` +
        `🔗 Track live: ${trackingLink}\n` +
        `━━━━━━━━━━━━━━━`
    );

    // Show confirmation button if rider has arrived
    if (session.status === 'arrived') {
        await sendButtons(to,
            `🛵 Your rider has arrived! Did you receive your package?`,
            [
                { id: `btn_cust_confirm_${sessionId}`, title: '✅ Yes, Received' },
                { id: `btn_cust_problem_${sessionId}`, title: '⚠️ Issue' },
            ]
        );
    }
}

// ─── CUSTOMER CONFIRMS DELIVERY ─────────────────────────────────
export async function handleCustomerConfirm(msg, params) {
    const sessionId = params.sessionId;
    if (!sessionId) return;

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session) {
            await sendText(msg.from, `❌ Delivery not found.`);
            return;
        }

        // Mark as completed (customer confirmed)
        const updates = {};
        updates[`sessions/${sessionId}/status`] = 'completed';
        updates[`sessions/${sessionId}/completedAt`] = Date.now();
        updates[`sessions/${sessionId}/completedBy`] = 'customer_whatsapp';
        if (session.vendorId) {
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/status`] = 'completed';
            updates[`vendors/${session.vendorId}/sessions/${sessionId}/completedAt`] = Date.now();
        }
        // Increment rider delivery count
        if (session.riderId) {
            const riderSnap = await adminDb.ref(`riders/${session.riderId}/totalDeliveries`).once('value');
            const count = (riderSnap.val() || 0) + 1;
            updates[`riders/${session.riderId}/totalDeliveries`] = count;
        }
        await adminDb.ref().update(updates);

        await sendText(msg.from,
            `✅ *Delivery Confirmed!*\n\n` +
            `Thank you for confirming receipt of #${session.refId}!\n\n` +
            `How was your experience?`
        );

        // Send rating prompt
        await sendButtons(msg.from,
            `Rate your delivery experience:`,
            [
                { id: `btn_rate_5_${sessionId}`, title: '⭐⭐⭐⭐⭐ Great' },
                { id: `btn_rate_3_${sessionId}`, title: '⭐⭐⭐ Okay' },
                { id: `btn_rate_1_${sessionId}`, title: '⭐ Poor' },
            ]
        );

        // Notify vendor
        await notifyVendor(session.vendorId,
            `✅ Customer confirmed delivery #${session.refId}!`
        );

    } catch (err) {
        console.error('[CUSTOMER] confirm error:', err);
        await sendText(msg.from, `❌ Failed to confirm. Try again.`);
    }
}

// ─── CUSTOMER REPORTS ISSUE ─────────────────────────────────────
export async function handleCustomerProblem(msg, params) {
    const sessionId = params.sessionId;
    if (!sessionId) return;

    try {
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();
        if (!session) return;

        // Flag the delivery
        await adminDb.ref(`sessions/${sessionId}`).update({
            hasIssue: true,
            issueReportedAt: Date.now(),
            issueReportedBy: 'customer_whatsapp',
        });

        await sendText(msg.from,
            `⚠️ We've flagged delivery #${session.refId}.\n\n` +
            `Your vendor *${session.vendorName || ''}* has been notified and will reach out to resolve this.\n\n` +
            `📞 Vendor support: Contact them through their store page.`
        );

        // Alert vendor
        await notifyVendor(session.vendorId,
            `⚠️ *Issue reported* on delivery #${session.refId}!\n` +
            `Customer: ${session.customerName || session.customerPhone}\n` +
            `Please follow up ASAP.`
        );

    } catch (err) {
        console.error('[CUSTOMER] problem error:', err);
        await sendText(msg.from, `❌ Failed to report issue. Please contact the vendor directly.`);
    }
}

// ─── CUSTOMER RATES DELIVERY ────────────────────────────────────
export async function handleCustomerRating(msg, params) {
    const { sessionId, rating } = params;
    if (!sessionId || !rating) return;

    try {
        // #3: Check for duplicate rating
        const sessionSnap = await adminDb.ref(`sessions/${sessionId}`).once('value');
        const session = sessionSnap.val();

        if (session?.customerRating) {
            const existingStars = '⭐'.repeat(session.customerRating);
            await sendText(msg.from,
                `You've already rated this delivery ${existingStars}\n` +
                `Thanks for your feedback! 🙏`
            );
            return;
        }

        // Save rating
        await adminDb.ref(`sessions/${sessionId}`).update({
            customerRating: rating,
            ratedAt: Date.now(),
        });

        // Update rider's average rating
        if (session?.riderId) {
            const riderRef = adminDb.ref(`riders/${session.riderId}`);
            const riderSnap = await riderRef.once('value');
            const rider = riderSnap.val() || {};
            const totalRatings = (rider.totalRatings || 0) + 1;
            const sumRatings = (rider.avgRating || 0) * (rider.totalRatings || 0) + rating;
            await riderRef.update({
                avgRating: Math.round((sumRatings / totalRatings) * 10) / 10,
                totalRatings,
            });
        }

        // Also store in vendor's rating data
        if (session?.vendorId) {
            await adminDb.ref(`vendors/${session.vendorId}/sessions/${sessionId}`).update({
                customerRating: rating,
            });
        }

        const stars = '⭐'.repeat(rating);
        await sendText(msg.from,
            `${stars}\n\n` +
            `Thank you for your feedback! 🙏\n` +
            `_Powered by RideWatch_`
        );

    } catch (err) {
        console.error('[CUSTOMER] rating error:', err);
    }
}

// ─── PROACTIVE CUSTOMER NOTIFICATIONS (called from rider flow) ──
export async function notifyCustomerStatusChange(session, sessionId, newStatus) {
    if (!session.customerPhone) return;

    try {
        const trackingLink = `https://ridewatchapp.com/t/${sessionId}`;
        let message = '';

        switch (newStatus) {
            case 'assigned':
                message = `📦 *Update on your delivery #${session.refId}*\n\n` +
                    `🛵 A rider has been assigned!\n` +
                    `Rider: ${session.riderName || 'Your rider'}\n` +
                    `📍 Track: ${trackingLink}`;
                break;
            case 'active':
                message = `📦 *Update on your delivery #${session.refId}*\n\n` +
                    `✅ Your rider has accepted the delivery!\n` +
                    `🛵 ${session.riderName || 'Rider'} is heading to pick up your package.\n` +
                    `📍 Track: ${trackingLink}`;
                break;
            case 'picked_up':
                message = `📦 *Update on your delivery #${session.refId}*\n\n` +
                    `📤 Your package has been picked up!\n` +
                    `🛵 ${session.riderName || 'Rider'} is on the way.\n` +
                    `📍 Track: ${trackingLink}`;
                break;
            case 'in_transit':
                message = `📦 *Update on your delivery #${session.refId}*\n\n` +
                    `🚚 Your package is in transit!\n` +
                    `🛵 ${session.riderName || 'Rider'} is heading your way.\n` +
                    `📍 Track live: ${trackingLink}`;
                break;
            case 'arrived':
                message = `📦 *Update on your delivery #${session.refId}*\n\n` +
                    `📍 *Your rider has arrived!*\n` +
                    `🛵 ${session.riderName || 'Rider'} is at your location.\n\n` +
                    `Please meet them to collect your package.`;
                break;
            default:
                return; // Don't notify for other statuses
        }

        if (message) {
            await sendText(session.customerPhone, message);
        }

    } catch (err) {
        console.error('[CUSTOMER] notify error:', err);
    }
}

// ─── HELPERS ────────────────────────────────────────────────────

async function notifyVendor(vendorId, message) {
    try {
        if (!vendorId) return;
        const vendorSnap = await adminDb.ref(`vendors/${vendorId}`).once('value');
        const vendor = vendorSnap.val();
        if (vendor?.whatsappPhone) {
            await sendText(vendor.whatsappPhone, message);
        }
    } catch (err) {
        console.error('[CUSTOMER] notifyVendor error:', err);
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

function formatStatus(status) {
    const labels = {
        pending: 'Pending — waiting for rider',
        assigned: 'Assigned — rider will pick up soon',
        active: 'Active — rider accepted',
        picked_up: 'Picked Up — on the way!',
        in_transit: 'In Transit — almost there!',
        arrived: 'Arrived — rider is at your location!',
        completed: 'Delivered ✓',
        cancelled: 'Cancelled',
    };
    return labels[status] || status;
}
