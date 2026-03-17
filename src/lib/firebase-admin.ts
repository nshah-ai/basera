import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    console.log('🔥 Initializing Firebase Admin with Project ID:', projectId);

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing Firebase Admin credentials:', {
            projectId: !!projectId,
            clientEmail: !!clientEmail,
            privateKey: !!privateKey
        });
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        console.log('✅ Firebase Admin initialized successfully.');
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error);
    }
}

export const adminDb = admin.firestore();
