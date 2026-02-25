/**
 * WhatsApp Link — Verify a link code and connect a vendor's WhatsApp number.
 *
 * POST /api/whatsapp-link
 * Body: { code: string, vendorId: string }
 *
 * The code is generated deterministically from the phone number by the bot.
 * We iterate over all stored pending link requests, or brute-check
 * the code against the incoming whatsapp phone.
 *
 * Actually, we store pendingLinks/{code} → { phone } when the bot sends the onboarding message,
 * so the vendor dashboard just submits the code and we resolve the phone from it.
 */
import { adminDb } from './lib/firebase-admin.js';

// Security
const ALLOWED_ORIGINS = [
    'https://ridewatchapp.com',
    'https://www.ridewatchapp.com',
    'https://ridewatch.vercel.app',
    'http://localhost:5173',
];

export default async function handler(request, response) {
    const origin = request.headers['origin'] || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

    const { code, vendorId } = request.body || {};

    if (!code || !vendorId) {
        return response.status(400).json({ error: 'Missing code or vendorId' });
    }

    // Verify the vendor exists
    const vendorSnap = await adminDb.ref(`vendors/${vendorId}`).once('value');
    if (!vendorSnap.exists()) {
        return response.status(404).json({ error: 'Vendor not found' });
    }

    try {
        // Look up the pending link by code
        const pendingSnap = await adminDb.ref(`pendingLinks/${code.toUpperCase()}`).once('value');

        if (!pendingSnap.exists()) {
            return response.status(400).json({ error: 'Invalid or expired code. Send "hi" to the RideWatch bot on WhatsApp to get a new code.' });
        }

        const { phone, expiresAt } = pendingSnap.val();

        // Check expiry
        if (expiresAt && Date.now() > expiresAt) {
            await adminDb.ref(`pendingLinks/${code.toUpperCase()}`).remove();
            return response.status(400).json({ error: 'Code expired. Send "hi" to the bot to get a new one.' });
        }

        // #2: Prevent duplicate linking — check if phone is already linked to another vendor
        const existingLink = await adminDb.ref(`whatsappUsers/${phone}`).once('value');
        if (existingLink.exists() && existingLink.val().vendorId !== vendorId) {
            return response.status(409).json({
                error: 'This WhatsApp number is already linked to another vendor account. Disconnect it there first.'
            });
        }

        // #2: Check if this vendor already has a different WhatsApp number linked
        const vendorData = vendorSnap.val();
        if (vendorData?.whatsappPhone && vendorData.whatsappPhone !== phone) {
            // Remove old mapping
            await adminDb.ref(`whatsappUsers/${vendorData.whatsappPhone}`).remove();
        }

        // Create the whatsappUsers mapping
        await adminDb.ref(`whatsappUsers/${phone}`).set({
            vendorId,
            role: 'vendor',
            linkedAt: Date.now(),
        });

        // Update vendor profile with WhatsApp number
        await adminDb.ref(`vendors/${vendorId}`).update({
            whatsappPhone: phone,
            whatsappLinkedAt: Date.now(),
        });

        // Clean up pending link
        await adminDb.ref(`pendingLinks/${code.toUpperCase()}`).remove();

        return response.status(200).json({
            success: true,
            phone: phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2'), // Masked phone
        });

    } catch (err) {
        console.error('[API] whatsapp-link error:', err);
        return response.status(500).json({ error: 'Failed to link WhatsApp account' });
    }
}
