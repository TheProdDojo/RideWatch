import { Resend } from 'resend';

const resend = new Resend('re_CC9vXgta_Ko6dvC8By87Ji3H2ZrmMEvkw');

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { to, riderName, refId, stopCode } = request.body;

    if (!to) {
        return response.status(400).json({ error: 'Missing recipient email' });
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
        return response.status(500).json({ error: error.message });
    }
}
