import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- Security: Allowed origins ---
const ALLOWED_ORIGINS = [
  'https://ridewatchapp.com',
  'https://www.ridewatchapp.com',
  'https://ridewatch.vercel.app',
];

// --- Security: In-memory rate limiter (per serverless instance) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 emails per IP per minute

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function getAllowedOrigin(request) {
  const origin = request.headers['origin'] || request.headers['Origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return null;
}

export default async function handler(request, response) {
  const origin = getAllowedOrigin(request);

  // Set CORS headers (only for allowed origins)
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    if (!origin) {
      return response.status(403).json({ error: 'Forbidden' });
    }
    return response.status(200).end();
  }

  // Method check
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Origin validation — reject requests from unknown origins
  const referer = request.headers['referer'] || request.headers['Referer'] || '';
  const isAllowedReferer = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
  if (!origin && !isAllowedReferer) {
    return response.status(403).json({ error: 'Forbidden: unknown origin' });
  }

  // Rate limiting
  const clientIp = request.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || request.headers['x-real-ip']
    || 'unknown';

  if (isRateLimited(clientIp)) {
    return response.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  // Input validation
  const { to, riderName, refId, stopCode } = request.body || {};

  if (!to || typeof to !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid recipient email' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return response.status(400).json({ error: 'Invalid email format' });
  }

  if (!riderName || !refId) {
    return response.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const data = await resend.emails.send({
      from: 'RideWatch <onboarding@resend.dev>',
      to: [to],
      subject: `Delivery Completed: ${refId}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #16a34a;">Delivery Completed! ✅</h1>
          <p>Rider <strong>${riderName}</strong> has successfully completed order <strong>${refId}</strong>.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Stop Code Used:</strong> ${stopCode}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="font-size: 12px; color: #666;">View full details in your <a href="https://ridewatch.vercel.app/vendor">Vendor Dashboard</a>.</p>
        </div>
      `,
    });

    return response.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Email send error:', error);
    return response.status(500).json({ error: 'Failed to send email' });
  }
}
