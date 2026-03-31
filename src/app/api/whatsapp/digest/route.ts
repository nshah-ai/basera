import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

    // Basic security check for CRON trigger (Vercel sets this header)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const households = await adminDb.collection('households').get();
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        for (const hDoc of households.docs) {
            const hData = hDoc.data();
            const users = hData.users || [];

            const pendingTasks = await hDoc.ref.collection('tasks')
                .where('status', '==', 'pending')
                .get();

            if (pendingTasks.empty) continue;

            const taskList = pendingTasks.docs.map(t => `- ${t.data().title}`).join('\n');

            for (const userData of users) {
                if (userData.phoneNumber) {
                    await client.messages.create({
                        from: 'whatsapp:+14155238886', // Twilio Sandbox Number
                        to: `whatsapp:${userData.phoneNumber}`,
                        body: `🏡 *Basera Daily Digest*\n\nYou have ${pendingTasks.size} tasks pending:\n\n${taskList}\n\nManage here: https://basera-home.vercel.app/`
                    });
                }
            }
        }

        return NextResponse.json({ success: true, processed: households.size });

    } catch (error) {
        console.error('Digest Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
