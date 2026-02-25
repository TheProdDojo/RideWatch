/**
 * Paystack Webhook — Server-side payment verification.
 *
 * POST /api/paystack-webhook
 *
 * Paystack sends webhook events here after a charge succeeds/fails.
 * We verify the HMAC signature using our secret key and update the
 * vendor profile in Firebase accordingly.
 */
import crypto from 'crypto';
import { adminDb } from './lib/firebase-admin.js';

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default async function handler(request, response) {
    // Only accept POST
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // ── Verify Paystack Signature ──
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
        console.error('[Paystack Webhook] PAYSTACK_SECRET_KEY not configured');
        return response.status(500).json({ error: 'Server misconfiguration' });
    }

    const signature = request.headers['x-paystack-signature'];
    if (!signature) {
        return response.status(400).json({ error: 'Missing signature' });
    }

    // Paystack signs the raw JSON body with HMAC SHA-512
    const rawBody = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);

    const hash = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

    if (hash !== signature) {
        console.warn('[Paystack Webhook] Invalid signature');
        return response.status(401).json({ error: 'Invalid signature' });
    }

    // ── Process Event ──
    const event = typeof request.body === 'string'
        ? JSON.parse(request.body)
        : request.body;

    console.log(`[Paystack Webhook] Event: ${event.event}`);

    try {
        if (event.event === 'charge.success') {
            await handleChargeSuccess(event.data);
        }
        // Always return 200 to Paystack (they retry on non-200)
        return response.status(200).json({ received: true });
    } catch (err) {
        console.error('[Paystack Webhook] Processing error:', err);
        // Still return 200 to prevent retries on processing errors
        return response.status(200).json({ received: true, error: 'Processing failed' });
    }
}

async function handleChargeSuccess(data) {
    const { reference, customer, amount, metadata } = data;

    // Extract vendor ID from metadata (set by SubscriptionModal)
    const vendorId = metadata?.custom_fields?.find(
        f => f.variable_name === 'vendor_code'
    )?.value;

    if (!vendorId) {
        console.error('[Paystack Webhook] No vendor_code in metadata. Reference:', reference);
        return;
    }

    // Verify vendor exists
    const vendorSnap = await adminDb.ref(`vendors/${vendorId}`).once('value');
    if (!vendorSnap.exists()) {
        console.error('[Paystack Webhook] Vendor not found:', vendorId);
        return;
    }

    const now = Date.now();
    const expiresAt = now + BILLING_CYCLE_MS;

    // Update vendor profile
    await adminDb.ref(`vendors/${vendorId}`).update({
        planType: 'pro',
        subscriptionStatus: 'active',
        subscriptionDate: now,
        subscriptionExpiresAt: expiresAt,
        paystackReference: reference,
        paystackCustomerCode: customer?.customer_code || null,
        paystackAmount: amount,
        updatedAt: now
    });

    console.log(`[Paystack Webhook] Vendor ${vendorId} upgraded to Pro. Expires: ${new Date(expiresAt).toISOString()}`);
}
