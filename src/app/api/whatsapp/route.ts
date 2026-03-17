import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import twilio from 'twilio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const incomingMsg = formData.get('Body') as string;
        const fromNumber = formData.get('From') as string;

        console.log(`Received WhatsApp from ${fromNumber}: ${incomingMsg}`);

        // 1. Find household by phone number
        const number = fromNumber.replace('whatsapp:', '');
        const householdsSnapshot = await adminDb.collection('households')
            .where('userPhoneNumbers', 'array-contains', number)
            .limit(1)
            .get();

        const messagingResponse = new twilio.twiml.MessagingResponse();

        if (householdsSnapshot.empty) {
            messagingResponse.message("🏡 Basera: We don't recognize this number. Please add it to your profile in the app first!");
            return new NextResponse(messagingResponse.toString(), {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        const hDoc = householdsSnapshot.docs[0];
        const householdId = hDoc.id;
        const hData = hDoc.data();

        // Find the specific user from the users array
        const user = hData.users.find((u: any) => u.phoneNumber === number);
        const userId = user?.id || 'Shared';

        if (!householdId) {
            throw new Error("Could not determine household ID");
        }

        // 2. Parse with Gemini
        const prompt = `Interpret the following text into a structured task for a household app. 
        Text: "${incomingMsg}"
        Today's Date: ${new Date().toLocaleDateString()}
        Output JSON only: { "title": string, "priority": "high"|"medium"|"low", "assigneeId": string|null, "dueDate": "YYYY-MM-DD" }
        If no priority mentioned, use "medium". If no date, use today. assigneeId should be "${userId}" if they say "me" or "I", otherwise null.`;

        const result = await model.generateContent(prompt);
        const taskDataRaw = result.response.text().replace(/```json|```/g, '').trim();
        const taskData = JSON.parse(taskDataRaw);

        // 3. Save to Firestore
        const newTask = {
            ...taskData,
            status: 'pending',
            createdAt: Date.now(),
            recurrence: 'none'
        };

        await adminDb.collection('households').doc(householdId).collection('tasks').add(newTask);

        // 4. Respond
        messagingResponse.message(`✅ Added: *${newTask.title}* (${newTask.priority})\nDue: ${newTask.dueDate}`);

        return new NextResponse(messagingResponse.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error) {
        console.error('WhatsApp Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
