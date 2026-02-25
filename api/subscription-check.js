/**
 * Subscription Check — Daily cron to expire lapsed subscriptions.
 *
 * GET /api/subscription-check
 *
 * Runs via Vercel Cron (daily at midnight UTC).
 * Scans for vendors with expired Pro subscriptions or trials and downgrades them.
 */
import { adminDb } from './lib/firebase-admin.js';

export default async function handler(request, response) {
    // Only accept GET (Vercel cron uses GET)
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // ── Verify Cron Secret (Vercel automatically sends this) ──
    const cronSecret = request.headers['authorization'];
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || cronSecret !== expectedSecret) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    const now = Date.now();
    let expiredPro = 0;
    let expiredTrial = 0;

    try {
        // ── 1. Expire Pro Subscriptions ──
        const vendorsSnap = await adminDb.ref('vendors').once('value');
        const vendors = vendorsSnap.val() || {};

        const updates = {};

        for (const [vendorId, vendor] of Object.entries(vendors)) {
            // Check active Pro subscriptions that have expired
            if (
                vendor.subscriptionStatus === 'active' &&
                vendor.planType === 'pro' &&
                vendor.subscriptionExpiresAt &&
                vendor.subscriptionExpiresAt < now
            ) {
                updates[`${vendorId}/planType`] = 'free';
                updates[`${vendorId}/subscriptionStatus`] = 'expired';
                updates[`${vendorId}/updatedAt`] = now;
                expiredPro++;
            }

            // Check cancelled Pro subscriptions past expiry (already set to cancel at period end)
            if (
                vendor.subscriptionStatus === 'cancelled' &&
                vendor.planType === 'pro' &&
                vendor.subscriptionExpiresAt &&
                vendor.subscriptionExpiresAt < now
            ) {
                updates[`${vendorId}/planType`] = 'free';
                updates[`${vendorId}/subscriptionStatus`] = 'expired';
                updates[`${vendorId}/updatedAt`] = now;
                expiredPro++;
            }

            // Check expired trials
            if (
                vendor.planType === 'trial' &&
                vendor.trialExpiresAt &&
                vendor.trialExpiresAt < now
            ) {
                updates[`${vendorId}/planType`] = 'free';
                updates[`${vendorId}/subscriptionStatus`] = 'trial_expired';
                updates[`${vendorId}/updatedAt`] = now;
                expiredTrial++;
            }
        }

        // Batch update
        if (Object.keys(updates).length > 0) {
            await adminDb.ref('vendors').update(updates);
        }

        console.log(`[Subscription Check] Expired ${expiredPro} Pro, ${expiredTrial} Trial subscriptions`);

        return response.status(200).json({
            success: true,
            expiredPro,
            expiredTrial,
            checkedAt: new Date(now).toISOString()
        });
    } catch (err) {
        console.error('[Subscription Check] Error:', err);
        return response.status(500).json({ error: 'Internal error' });
    }
}
