import { Resend } from 'resend';
import admin from 'firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// --- Security: Allowed origins ---
const ALLOWED_ORIGINS = [
  'https://ridewatchapp.com',
  'https://www.ridewatchapp.com',
  'https://ridewatch.vercel.app',
];

// --- Security: In-memory rate limiter (per serverless instance) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // max 3 reset requests per IP per 15 mins

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

  // CORS headers — restricted to allowed origins only
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (request.method === 'OPTIONS') {
    if (!origin) {
      return response.status(403).json({ error: 'Forbidden' });
    }
    return response.status(200).end();
  }

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
    // Still return 200 to not reveal rate limiting to attackers
    return response.status(200).json({ success: true });
  }

  const { email } = request.body || {};

  if (!email || typeof email !== 'string') {
    return response.status(400).json({ error: 'Missing email address' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Generate a password reset link via Firebase Admin
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: 'https://ridewatchapp.com/vendor/login',
    });

    // Extract the oobCode from the Firebase link and build our custom URL
    const url = new URL(resetLink);
    const oobCode = url.searchParams.get('oobCode');
    const customResetLink = `https://ridewatchapp.com/vendor/reset-password?oobCode=${oobCode}`;

    // Send beautiful branded email via Resend
    const data = await resend.emails.send({
      from: 'RideWatch <ridewatch@deproductdojo.com>',
      to: [email],
      subject: 'Reset your RideWatch password',
      html: generateResetEmailHTML(email, customResetLink),
    });

    return response.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Password reset error:', error);

    // Don't reveal if email exists or not (security best practice)
    return response.status(200).json({ success: true });
  }
}

function generateResetEmailHTML(email, resetLink) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                <span style="color: #4ade80;">Ride</span>Watch
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px 32px;">
              
              <!-- Icon -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="width: 56px; height: 56px; background-color: rgba(74, 222, 128, 0.15); border-radius: 50%; line-height: 56px; text-align: center;">
                      <span style="font-size: 24px;">🔐</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                      Password Reset Request
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Body text -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                      We received a request to reset the password for the account associated with
                      <span style="color: #e2e8f0; font-weight: 500;">${email}</span>.
                      Click the button below to set a new password.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${resetLink}" 
                       style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 10px; letter-spacing: 0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="background-color: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 8px; padding: 12px 16px;">
                      <p style="margin: 0; font-size: 13px; color: #fbbf24;">
                        ⏱ This link expires in 1 hour
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                      If the button doesn't work, copy and paste this link into your browser:<br/>
                      <a href="${resetLink}" style="color: #4ade80; word-break: break-all; text-decoration: none;">${resetLink}</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #475569;">
                If you didn't request this, you can safely ignore this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #334155;">
                © ${new Date().getFullYear()} RideWatch · A product of
                <a href="https://deproductdojo.com" style="color: #4ade80; text-decoration: none;">The Product Dojo</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
