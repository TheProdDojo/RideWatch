/**
 * Intent parser — detects what the user wants from text, button taps, or list selections.
 * Returns: { intent: string, params: object }
 *
 * Supported intents:
 *   MENU, CREATE_DELIVERY, ASSIGN_RIDER, CHECK_STATUS, DAILY_SUMMARY,
 *   LIST_RIDERS, CANCEL_DELIVERY, CONFIRM_YES, CONFIRM_NO, HELP, UNKNOWN
 */

// Keyword → intent mapping (checked in order, first match wins)
const KEYWORD_RULES = [
    { intent: 'MENU', patterns: [/^menu$/i, /^start$/i, /^hi$/i, /^hello$/i, /^hey$/i] },
    { intent: 'CREATE_DELIVERY', patterns: [/^new\s*(delivery|order)/i, /^create\s*(delivery|order)/i, /^send\s*(package|delivery)/i] },
    { intent: 'CHECK_STATUS', patterns: [/^(status|where|track)/i, /^check\s/i, /^find\s/i] },
    { intent: 'DAILY_SUMMARY', patterns: [/^(summary|dashboard|today|report|stats)/i, /how.*(today|look)/i] },
    { intent: 'LIST_RIDERS', patterns: [/^(riders?|my riders?|list riders?)/i] },
    { intent: 'CANCEL_DELIVERY', patterns: [/^cancel/i] },
    { intent: 'EXPORT', patterns: [/^export/i] },
    { intent: 'HELP', patterns: [/^help$/i, /^\?$/] },
];

// Button ID → intent mapping (from interactive messages)
const BUTTON_MAP = {
    'btn_menu': 'MENU',
    'btn_new_delivery': 'CREATE_DELIVERY',
    'btn_summary': 'DAILY_SUMMARY',
    'btn_my_riders': 'LIST_RIDERS',
    'btn_check_status': 'CHECK_STATUS',
    'btn_cancel': 'CANCEL_DELIVERY',
    'btn_yes': 'CONFIRM_YES',
    'btn_no': 'CONFIRM_NO',
    'btn_help': 'HELP',
    'btn_skip': 'SKIP',
    'btn_send_customer': 'SEND_TO_CUSTOMER',
    'btn_send_rider': 'SEND_TO_RIDER',
};

/**
 * Parse an incoming message into an intent + params.
 * @param {object} msg - Extracted message from whatsapp.extractMessage()
 * @returns {{ intent: string, params: object }}
 */
export function parseIntent(msg) {
    // Button reply — direct mapping
    if (msg.buttonReply) {
        const intent = BUTTON_MAP[msg.buttonReply.id];
        if (intent) return { intent, params: { buttonId: msg.buttonReply.id, buttonTitle: msg.buttonReply.title } };
    }

    // List reply — the ID encodes the intent + resource
    // Format: "action_resourceId" e.g. "assign_rider_r1234" or "status_sess_abc123"
    if (msg.listReply) {
        const id = msg.listReply.id;

        if (id.startsWith('assign_rider_')) {
            return { intent: 'ASSIGN_RIDER', params: { riderId: id.replace('assign_rider_', '') } };
        }
        if (id.startsWith('status_')) {
            return { intent: 'CHECK_STATUS', params: { sessionId: id.replace('status_', '') } };
        }
        if (id.startsWith('cancel_')) {
            return { intent: 'CANCEL_DELIVERY', params: { sessionId: id.replace('cancel_', '') } };
        }

        return { intent: 'UNKNOWN', params: { listReply: msg.listReply } };
    }

    // Location message — could be for delivery creation or live tracking
    if (msg.type === 'location' && msg.location) {
        return {
            intent: 'LOCATION_SHARED',
            params: {
                latitude: msg.location.latitude,
                longitude: msg.location.longitude,
                address: msg.location.address || msg.location.name || '',
            },
        };
    }

    // Free text — keyword matching
    const text = (msg.text || '').trim();
    if (!text) return { intent: 'UNKNOWN', params: {} };

    for (const rule of KEYWORD_RULES) {
        for (const pattern of rule.patterns) {
            if (pattern.test(text)) {
                return { intent: rule.intent, params: { rawText: text } };
            }
        }
    }

    // Check for delivery-style free text: "New delivery to [address] for [name], [phone]"
    const deliveryMatch = text.match(/(?:deliver|send|ship)\w*\s+(?:to\s+)?(.+?)(?:\s+for\s+)(.+?),?\s*(0[789]\d{9}|\+234\d{10})/i);
    if (deliveryMatch) {
        return {
            intent: 'CREATE_DELIVERY',
            params: {
                destination: deliveryMatch[1].trim(),
                customerName: deliveryMatch[2].trim(),
                customerPhone: deliveryMatch[3].trim(),
                rawText: text,
            },
        };
    }

    // Check for status query with ref ID
    const statusMatch = text.match(/(?:status|where|track)\w*\s+(?:of\s+)?#?(\S+)/i);
    if (statusMatch) {
        return {
            intent: 'CHECK_STATUS',
            params: { refId: statusMatch[1], rawText: text },
        };
    }

    // Nothing matched — treat as unknown
    return { intent: 'UNKNOWN', params: { rawText: text } };
}
