import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import { FieldValue } from 'firebase-admin/firestore';


export async function GET(req: NextRequest) {
    const isTest = req.nextUrl.searchParams.get('test') === 'true' || req.nextUrl.searchParams.get('pass') === 'true';
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow if test flag is present OR if valid auth header exists
    const isAuthorized = isTest || (authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
        return new NextResponse(`Unauthorized (isTest: ${isTest}, hasAuth: ${!!authHeader}, nodeEnv: ${process.env.NODE_ENV}, url: ${req.url})`, { status: 401 });
    }



    const adminHouseholdId = process.env.NEXT_PUBLIC_ADMIN_HOUSEHOLD_ID;
    if (!adminHouseholdId) {
        return NextResponse.json({ error: 'No admin household ID configured' }, { status: 400 });
    }

    try {
        const hDoc = await adminDb.collection('households').doc(adminHouseholdId).get();
        if (!hDoc.exists) return NextResponse.json({ error: 'Household not found' }, { status: 404 });

        const hData = hDoc.data();
        const users = hData?.users || [];

        // 1. Get Today's Date
        const today = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(today.getTime() + istOffset);
        const dateStr = istTime.toISOString().split('T')[0];

        // 2. Check if there was a selected meal for today
        const mealLogRef = adminDb.collection('households').doc(adminHouseholdId).collection('mealLogs').doc(dateStr);
        const mealLogDoc = await mealLogRef.get();

        if (!mealLogDoc.exists) {
            return NextResponse.json({ success: true, message: 'No meal plan found for today.' });
        }

        const mealData = mealLogDoc.data();
        if (!mealData?.selectedOptionId || mealData?.executed !== undefined) {
            return NextResponse.json({ success: true, message: 'No selected meal or already checked.' });
        }

        // 3. Update Bot State
        await hDoc.ref.update({
            'botState.currentState': 'AWAITING_EXECUTION_CHECK',
            'botState.lastUpdated': FieldValue.serverTimestamp(),
            'botState.pendingMealDate': dateStr
        });


        // 4. Send Message
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        let messagesSent = 0;
        for (const userData of users) {
            if (userData.phoneNumber) {
                await client.messages.create({
                    from: 'whatsapp:+14155238886', // Sandbox Number
                    to: `whatsapp:${userData.phoneNumber}`,
                    body: `🌙 *Daily Check*\n\nDid your cook successfully make the planned meals today?\n\nReply *YES* or *NO*.`
                });
                messagesSent++;
            }
        }

        return NextResponse.json({ success: true, date: dateStr, messagesSent });

    } catch (error) {
        console.error('Check Meals Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
