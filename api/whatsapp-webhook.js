/**
 * WhatsApp Webhook — Main entry point.
 *
 * GET  /api/whatsapp-webhook  → Meta verification challenge
 * POST /api/whatsapp-webhook  → Incoming message processing
 */
import { extractMessage, markRead, sendText } from './lib/whatsapp.js';
import { parseIntent } from './lib/intent-parser.js';
import { adminDb } from './lib/firebase-admin.js';
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
import {
    resolveRider,
    handleRiderMenu,
    handleRiderAccept,
    handleRiderReject,
    handleRiderStatusUpdate,
    handleRiderStopCode,
    handleRiderViewDelivery,
} from './lib/rider-commands.js';
import {
    resolveCustomer,
    handleCustomerStatus,
    handleCustomerConfirm,
    handleCustomerProblem,
    handleCustomerRating,
} from './lib/customer-commands.js';

// ── #1: Message deduplication (in-memory, per-instance) ──
const processedMessages = new Map();
const DEDUP_TTL_MS = 60 * 1000; // 60 seconds

function isDuplicate(messageId) {
    const now = Date.now();
    // Clean expired entries
    for (const [id, ts] of processedMessages) {
        if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
    }
    if (processedMessages.has(messageId)) return true;
    processedMessages.set(messageId, now);
    return false;
}

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

        // #1: Dedup — skip if we've already processed this message
        if (isDuplicate(msg.messageId)) {
            console.log(`[WA] Duplicate message ${msg.messageId}, skipping`);
            return response.status(200).json({ status: 'ok' });
        }

        // #13: Group message filter — ignore messages from groups
        if (msg.from?.includes('-') || msg.isGroup) {
            return response.status(200).json({ status: 'ok' });
        }

        try {
            // Mark message as read (blue ticks)
            await markRead(msg.messageId);

            // Resolve vendor by phone number
            const vendor = await resolveVendor(msg.from);

            // If not a vendor, check if they're a rider
            const rider = !vendor ? await resolveRider(msg.from) : null;

            // If neither vendor nor rider, check if customer
            const customer = (!vendor && !rider) ? await resolveCustomer(msg.from) : null;

            // Parse intent
            const { intent, params } = parseIntent(msg);
            console.log(`[WA] ${msg.from} → ${intent} [${vendor ? 'vendor' : rider ? 'rider' : customer ? 'customer' : 'unknown'}]`, JSON.stringify(params));

            // ── CUSTOMER ROUTING ──
            if (customer) {
                switch (intent) {
                    case 'CUSTOMER_CONFIRM':
                        await handleCustomerConfirm(msg, params);
                        break;
                    case 'CUSTOMER_PROBLEM':
                        await handleCustomerProblem(msg, params);
                        break;
                    case 'CUSTOMER_RATE':
                        await handleCustomerRating(msg, params);
                        break;
                    default:
                        // Any other message from a customer = show their delivery status
                        await handleCustomerStatus(msg, customer);
                }
                return response.status(200).json({ status: 'ok' });
            }

            // ── RIDER ROUTING ──
            if (rider) {
                switch (intent) {
                    case 'MENU':
                    case 'RIDER_MY_DELIVERIES':
                        await handleRiderMenu(msg, rider);
                        break;
                    case 'RIDER_ACCEPT':
                        await handleRiderAccept(msg, params, rider);
                        break;
                    case 'RIDER_REJECT':
                        await handleRiderReject(msg, params, rider);
                        break;
                    case 'RIDER_PICKUP':
                        await handleRiderStatusUpdate(msg, params, rider, 'picked_up');
                        break;
                    case 'RIDER_IN_TRANSIT':
                        await handleRiderStatusUpdate(msg, params, rider, 'in_transit');
                        break;
                    case 'RIDER_ARRIVED':
                        await handleRiderStatusUpdate(msg, params, rider, 'arrived');
                        break;
                    case 'RIDER_STOP_CODE':
                        await handleRiderStopCode(msg, params, rider);
                        break;
                    case 'RIDER_VIEW_DELIVERY':
                        await handleRiderViewDelivery(msg, params, rider);
                        break;
                    case 'HELP':
                        await sendText(msg.from,
                            `🛵 *Rider Commands*\n` +
                            `━━━━━━━━━━━━━━━\n` +
                            `📋 *"menu"* — Your active deliveries\n` +
                            `✅ Tap *Accept/Decline* on assignments\n` +
                            `📤 Update status with buttons\n` +
                            `🔑 Enter the *4-digit stop code* to complete\n` +
                            `━━━━━━━━━━━━━━━`
                        );
                        break;
                    default:
                        await handleRiderMenu(msg, rider);
                }
                return response.status(200).json({ status: 'ok' });
            }

            // ── VENDOR ROUTING ──

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
                    if (vendor) {
                        await sendText(msg.from,
                            `📍 Location received!\n` +
                            `${params.address || `${params.latitude}, ${params.longitude}`}\n\n` +
                            `_Live location tracking for riders coming soon!_`
                        );
                    }
                    break;

                case 'MEDIA_RECEIVED':
                    // #12: Respond helpfully to media messages
                    await sendText(msg.from,
                        `📎 Got your ${params.mediaType || 'file'}!\n\n` +
                        `I can't process media yet, but I can help with:\n` +
                        `📦 *\"new delivery\"* — Create a delivery\n` +
                        `🔍 *\"status\"* — Check a delivery\n` +
                        `Or type *\"menu\"* for all options.`
                    );
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

