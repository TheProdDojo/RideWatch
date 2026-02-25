/**
 * WhatsApp Webhook — Main entry point.
 *
 * GET  /api/whatsapp-webhook  → Meta verification challenge
 * POST /api/whatsapp-webhook  → Incoming message processing
 */
import { extractMessage, markRead } from './lib/whatsapp.js';
import { parseIntent } from './lib/intent-parser.js';
import {
    resolveVendor,
    handleMenu,
    handleHelp,
    handleCreateDelivery,
    handleAssignRider,
    handleSendToCustomer,
    handleCheckStatus,
    handleDailySummary,
    handleListRiders,
    handleCancelDelivery,
    handleOnboarding,
    handleUnknown,
} from './lib/commands.js';

export default async function handler(request, response) {
    // ── GET: Meta Webhook Verification ──
    if (request.method === 'GET') {
        const mode = request.query['hub.mode'];
        const token = request.query['hub.verify_token'];
        const challenge = request.query['hub.challenge'];

        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log('[WA] Webhook verified');
            return response.status(200).send(challenge);
        }

        return response.status(403).json({ error: 'Verification failed' });
    }

    // ── POST: Incoming Messages ──
    if (request.method === 'POST') {
        // Always respond 200 immediately — WhatsApp retries on non-200
        const body = request.body;

        // Status update notifications (delivered, read, etc.) — acknowledge and skip
        const statusUpdate = body?.entry?.[0]?.changes?.[0]?.value?.statuses;
        if (statusUpdate) {
            return response.status(200).json({ status: 'ok' });
        }

        const msg = extractMessage(body);
        if (!msg) {
            return response.status(200).json({ status: 'ok' });
        }

        try {
            // Mark message as read (blue ticks)
            await markRead(msg.messageId);

            // Resolve vendor by phone number
            const vendor = await resolveVendor(msg.from);

            // Parse intent
            const { intent, params } = parseIntent(msg);
            console.log(`[WA] ${msg.from} → ${intent}`, JSON.stringify(params));

            // Route to handler
            switch (intent) {
                case 'MENU':
                    await handleMenu(msg, vendor);
                    break;

                case 'HELP':
                    await handleHelp(msg);
                    break;

                case 'CREATE_DELIVERY':
                    await handleCreateDelivery(msg, params, vendor);
                    break;

                case 'ASSIGN_RIDER':
                    await handleAssignRider(msg, params, vendor);
                    break;

                case 'SEND_TO_CUSTOMER':
                    await handleSendToCustomer(msg, params, vendor);
                    break;

                case 'CHECK_STATUS':
                    await handleCheckStatus(msg, params, vendor);
                    break;

                case 'DAILY_SUMMARY':
                    await handleDailySummary(msg, params, vendor);
                    break;

                case 'LIST_RIDERS':
                    await handleListRiders(msg, params, vendor);
                    break;

                case 'CANCEL_DELIVERY':
                    await handleCancelDelivery(msg, params, vendor);
                    break;

                case 'SKIP':
                    await handleMenu(msg, vendor);
                    break;

                case 'LOCATION_SHARED':
                    // Phase 5: Live location tracking
                    // For now, acknowledge the location
                    if (vendor) {
                        // Could be for creating a delivery with pickup location
                        const { sendText } = await import('./lib/whatsapp.js');
                        await sendText(msg.from,
                            `📍 Location received!\n` +
                            `${params.address || `${params.latitude}, ${params.longitude}`}\n\n` +
                            `_Live location tracking for riders coming soon!_`
                        );
                    }
                    break;

                default:
                    if (!vendor) {
                        await handleOnboarding(msg);
                    } else {
                        await handleUnknown(msg);
                    }
            }
        } catch (err) {
            console.error('[WA] Handler error:', err);
        }

        return response.status(200).json({ status: 'ok' });
    }

    // Other methods
    return response.status(405).json({ error: 'Method not allowed' });
}
