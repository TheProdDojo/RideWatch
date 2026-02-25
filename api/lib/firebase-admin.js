/**
 * Firebase Admin SDK — singleton for Vercel serverless functions.
 * Uses FIREBASE_SERVICE_ACCOUNT env var (base64-encoded JSON key).
 */
import admin from 'firebase-admin';

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://ridewatch-8291a-default-rtdb.firebaseio.com',
    });
}

export const adminDb = admin.database();
export default admin;
