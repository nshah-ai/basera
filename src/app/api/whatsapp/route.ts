import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import twilio from 'twilio';

export async function POST(req: NextRequest) {
    console.log('--- 📨 Incoming WhatsApp Webhook ---');
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`🔑 Gemini Key Present: ${!!apiKey} (Length: ${apiKey?.length || 0})`);

        const genAI = new GoogleGenerativeAI(apiKey || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const formData = await req.formData();
        const incomingMsg = (formData.get('Body') as string) || '';
        const fromNumber = (formData.get('From') as string) || '';

        console.log(`📍 From: ${fromNumber}`);
        console.log(`💬 Message: "${incomingMsg}"`);

        const messagingResponse = new twilio.twiml.MessagingResponse();
        const number = fromNumber.replace('whatsapp:', '');

        // 1. Find household by phone number
        console.log(`🔍 Looking up household for number: ${number}`);
        const householdsSnapshot = await adminDb.collection('households')
            .where('userPhoneNumbers', 'array-contains', number)
            .limit(1)
            .get();

        if (householdsSnapshot.empty) {
            console.warn(`❌ No household found for ${number}`);
            messagingResponse.message("🏡 Basera: We don't recognize this number. Please add it to your profile in the app first!");
            return new NextResponse(messagingResponse.toString(), {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        const hDoc = householdsSnapshot.docs[0];
        const householdId = hDoc.id;
        const hData = hDoc.data();
        console.log(`🏠 Found Household: ${householdId}`);

        // Find the specific user
        const user = hData.users?.find((u: any) => u.phoneNumber === number);
        const userId = user?.id || 'Shared';
        console.log(`👤 Mapped to User ID: ${userId} (${user?.name || 'Unknown'})`);

        // 2. Parse with Gemini
        console.log('🤖 Parsing with Gemini...');
        const prompt = `Interpret the following text into a structured task for a household app. 
        Text: "${incomingMsg}"
        Today's Date: ${new Date().toLocaleDateString()}
        Output JSON only: { "title": string, "priority": "high"|"medium"|"low", "assigneeId": string|null, "dueDate": "YYYY-MM-DD" }
        If no priority mentioned, use "medium". If no date, use today. assigneeId should be "${userId}" if they say "me" or "I", otherwise null.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const taskDataRaw = text.replace(/```json|```/g, '').trim();
        console.log('📝 Gemini Result:', taskDataRaw);
        const taskData = JSON.parse(taskDataRaw);

        // 3. Save to Firestore
        const newTask = {
            ...taskData,
            status: 'pending',
            createdAt: Date.now(),
            recurrence: 'none'
        };

        console.log(`💾 Saving task to households/${householdId}/tasks...`);
        const taskRef = await adminDb.collection('households').doc(householdId).collection('tasks').add(newTask);
        console.log(`✅ Task saved with ID: ${taskRef.id}`);

        // 4. Respond
        const responseBody = `✅ Added to Basera: *${newTask.title}*\nPriority: ${newTask.priority}\nDue: ${newTask.dueDate}`;
        messagingResponse.message(responseBody);

        return new NextResponse(messagingResponse.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: any) {
        console.error('💥 WhatsApp Webhook Crash:', error);
        const messagingResponse = new twilio.twiml.MessagingResponse();
        messagingResponse.message(`⚠️ Error: ${error.message || 'Unknown error occurred'}`);
        return new NextResponse(messagingResponse.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });
    }
}
