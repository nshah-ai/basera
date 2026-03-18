import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { User } from '@/types';
import twilio from 'twilio';


// Use gemini-2.0-flash based on your registry list
const MODEL_NAME = "gemini-2.0-flash";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || 'KA5HX7';

    let taskCount = 0;
    try {
        const snapshot = await adminDb.collection('households').doc(code).collection('tasks').get();
        taskCount = snapshot.size;
    } catch (e) { }

    const apiKey = process.env.GEMINI_API_KEY;
    return NextResponse.json({
        diagnostics: "Basera Webhook Status",
        household: code,
        dbTaskCount: taskCount,
        geminiKeyConfigured: !!apiKey,
        geminiKeyLength: apiKey?.length || 0,
        modelTarget: "models/gemini-2.0-flash",
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: NextRequest) {
    console.log('--- 📨 Incoming WhatsApp Webhook ---');
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`🔑 Gemini Key Present: ${!!apiKey} (Length: ${apiKey?.length || 0})`);

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is missing from environment variables.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

        const formData = await req.formData();
        const incomingMsg = (formData.get('Body') as string) || '';
        const fromNumber = (formData.get('From') as string) || '';

        console.log(`📍 From: ${fromNumber}`);
        console.log(`💬 Message: "${incomingMsg}"`);

        const messagingResponse = new twilio.twiml.MessagingResponse();
        const number = fromNumber.replace('whatsapp:', '');

        // --- NEW: Debug Commands ---
        if (incomingMsg.toLowerCase().trim() === 'whoami') {
            const snapshot = await adminDb.collection('households')
                .where('userPhoneNumbers', 'array-contains', number)
                .get();

            messagingResponse.message(`🕵️ WhatsApp ID: ${number}\n🏠 Found Household: ${!snapshot.empty ? snapshot.docs[0].id : 'Not Found'}`);
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        if (incomingMsg.toLowerCase().startsWith('test:')) {
            console.log('🧪 Echo mode triggered');
            messagingResponse.message(`🧪 Echo: ${incomingMsg.substring(5).trim()}`);
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // 1. Find household by phone number
        console.log(`🔍 Looking up household for number: ${number}`);
        const householdsSnapshot = await adminDb.collection('households')
            .where('userPhoneNumbers', 'array-contains', number)
            .limit(1)
            .get();

        if (householdsSnapshot.empty) {
            console.warn(`❌ No household found for ${number}`);
            messagingResponse.message("🏡 Basera: We don't recognize this number. Please add it to your profile in the app first!");
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        const hDoc = householdsSnapshot.docs[0];
        const householdId = hDoc.id;
        const hData = hDoc.data();
        console.log(`🏠 Found Household: ${householdId}`);

        // Find the specific user
        const user = hData.users?.find((u: any) => u.phoneNumber === number);
        const userId = user?.id || 'Shared';

        // Helper for IST Date (YYYY-MM-DD)
        const getISTDate = () => {
            const date = new Date();
            const offset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(date.getTime() + offset);
            return istDate.toISOString().split('T')[0];
        };

        const todayIST = getISTDate();

        // --- NEW: Fast Path (Bypass AI) ---
        let taskData;
        if (incomingMsg.toLowerCase().startsWith('fast:')) {
            console.log('⚡ Fast path (IST):', todayIST);
            taskData = {
                title: incomingMsg.substring(5).trim() || "Express Task",
                priority: "medium",
                assigneeId: userId,
                dueDate: todayIST
            };
        } else {
            // 2. Parse with Gemini (with 7s Timeout)
            console.log('🤖 Gemini parsing starting...');
            try {
                // Get all users in the household for context
                const householdUsers = (hData.users || []) as User[];
                const userListContext = householdUsers.map(u => `- ${u.name} (ID: ${u.id})`).join('\n');

                const prompt = `
                Household members:
                ${userListContext}

                Current User: ${user?.name || 'Unknown'} (ID: ${userId})
                Current Date: ${todayIST}

                Task to parse: "${incomingMsg}"

                Instructions:
                1. Extract the title of the task.
                2. Determine priority ("high", "medium", "low"). Defaults to "medium".
                3. Assign to a member ID if mentioned (e.g. "for Avanya" or "assign to Nishad"). 
                   - Look for names in the household members list.
                   - If "me" or "I" is used, assign to Current User ID.
                   - If no mention, set assigneeId to null.
                4. Determine dueDate ("YYYY-MM-DD"). Defaults to Current Date.

                Output JSON only: { "title": string, "priority": string, "assigneeId": string|null, "dueDate": string }`;

                const aiPromise = model.generateContent(prompt);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI Timeout (7s)")), 7000));

                const result: any = await Promise.race([aiPromise, timeoutPromise]);
                const text = (await result.response).text();
                const taskDataRaw = text.replace(/```json|```/g, '').trim();
                taskData = JSON.parse(taskDataRaw);
            } catch (aiError: any) {
                console.warn('⚠️ Gemini Speed issue or parsing error:', aiError.message);
                // Fallback to basic task on timeout/error
                taskData = {
                    title: incomingMsg,
                    priority: "medium",
                    assigneeId: null,
                    dueDate: todayIST
                };
            }
        }

        // 3. Save to Firestore
        try {
            const taskId = Math.random().toString(36).substring(2, 11);
            console.log(`💾 Syncing Task: ${taskId} to ${householdId}`);

            const newTask = {
                id: taskId,
                ...taskData,
                status: 'pending',
                createdAt: Date.now(),
                recurrence: 'none'
            };

            await adminDb.collection('households').doc(householdId).collection('tasks').doc(taskId).set(newTask);
            messagingResponse.message(`✅ Added to Basera: *${newTask.title}*`);
        } catch (dbError: any) {
            console.error('❌ DB Error:', dbError.message);
            messagingResponse.message(`💾 Database Error: ${dbError.message}`);
        }

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
