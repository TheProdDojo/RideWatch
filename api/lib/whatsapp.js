/**
 * WhatsApp Cloud API helper functions.
 * Handles sending text, interactive buttons, lists, and location messages.
 */

const WHATSAPP_API_VERSION = 'v22.0';

function getApiUrl() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
}

function getHeaders() {
    return {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Send a plain text message.
 */
export async function sendText(to, body) {
    // #10: WhatsApp has a 4096 char limit — chunk long messages
    if (body.length > 4000) {
        const chunks = [];
        let remaining = body;
        while (remaining.length > 0) {
            // Try to split at a newline near the limit
            let splitAt = remaining.lastIndexOf('\n', 3900);
            if (splitAt < 2000) splitAt = 3900;
            chunks.push(remaining.substring(0, splitAt));
            remaining = remaining.substring(splitAt).trimStart();
        }
        let lastData;
        for (const chunk of chunks) {
            lastData = await sendTextRaw(to, chunk);
        }
        return lastData;
    }
    return sendTextRaw(to, body);
}

async function sendTextRaw(to, body) {
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: true, body },
        }),
    });
    const data = await res.json();
    if (!res.ok) console.error('[WA] sendText error:', JSON.stringify(data));
    return data;
}

/**
 * Send interactive buttons (max 3 buttons).
 * buttons: [{ id: 'btn_1', title: 'Yes' }, ...]
 */
export async function sendButtons(to, bodyText, buttons, headerText = null, footerText = null) {
    const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
                buttons: buttons.map(b => ({
                    type: 'reply',
                    reply: { id: b.id, title: b.title.substring(0, 20) },
                })),
            },
        },
    };

    if (headerText) message.interactive.header = { type: 'text', text: headerText };
    if (footerText) message.interactive.footer = { text: footerText };

    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(message),
    });
    const data = await res.json();
    if (!res.ok) console.error('[WA] sendButtons error:', JSON.stringify(data));
    return data;
}

/**
 * Send an interactive list (up to 10 items per section, 10 sections).
 * sections: [{ title: 'Riders', rows: [{ id: 'r1', title: 'Emeka', description: '5 deliveries' }] }]
 */
export async function sendList(to, bodyText, buttonLabel, sections, headerText = null, footerText = null) {
    const message = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'list',
            body: { text: bodyText },
            action: {
                button: buttonLabel.substring(0, 20),
                sections: sections.map(s => ({
                    title: s.title,
                    rows: s.rows.map(r => ({
                        id: r.id,
                        title: r.title.substring(0, 24),
                        description: r.description ? r.description.substring(0, 72) : undefined,
                    })),
                })),
            },
        },
    };

    if (headerText) message.interactive.header = { type: 'text', text: headerText };
    if (footerText) message.interactive.footer = { text: footerText };

    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(message),
    });
    const data = await res.json();
    if (!res.ok) console.error('[WA] sendList error:', JSON.stringify(data));
    return data;
}

/**
 * Mark a message as read (blue ticks).
 */
export async function markRead(messageId) {
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        }),
    });
    return res.json();
}

/**
 * Extract the message payload from a WhatsApp webhook event.
 * Returns { from, messageId, type, text, buttonReply, listReply, location, name } or null.
 */
export function extractMessage(body) {
    try {
        const entry = body?.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;

        if (!value?.messages?.length) return null;

        const msg = value.messages[0];
        const contact = value.contacts?.[0];

        const result = {
            from: msg.from,                     // Phone number (e.g., "2348012345678")
            messageId: msg.id,
            type: msg.type,                     // text, interactive, location, image, etc.
            name: contact?.profile?.name || '',
            timestamp: msg.timestamp,
        };

        switch (msg.type) {
            case 'text':
                result.text = msg.text?.body || '';
                break;
            case 'interactive':
                if (msg.interactive?.type === 'button_reply') {
                    result.buttonReply = {
                        id: msg.interactive.button_reply.id,
                        title: msg.interactive.button_reply.title,
                    };
                } else if (msg.interactive?.type === 'list_reply') {
                    result.listReply = {
                        id: msg.interactive.list_reply.id,
                        title: msg.interactive.list_reply.title,
                        description: msg.interactive.list_reply.description,
                    };
                }
                break;
            case 'location':
                result.location = {
                    latitude: msg.location.latitude,
                    longitude: msg.location.longitude,
                    name: msg.location.name || '',
                    address: msg.location.address || '',
                };
                break;
            case 'image':
            case 'audio':
            case 'video':
            case 'document':
            case 'sticker':
                result.mediaType = msg.type;
                break;
            default:
                result.text = '';
        }

        // #13: Flag group messages (group IDs contain a hyphen)
        result.isGroup = msg.from?.includes('-') || (value.metadata?.display_phone_number !== msg.from && msg.group_id != null);


        return result;
    } catch (err) {
        console.error('[WA] extractMessage error:', err);
        return null;
    }
}
