import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { User } from '@/types';
import twilio from 'twilio';


// Use gemini-2.0-flash based on your registry list
const MODEL_NAME = "gemini-2.0-flash";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || 'test';

    let tasks: any[] = [];
    try {
        const snapshot = await adminDb.collection('households').doc(code).collection('tasks')
            .orderBy('createdAt', 'desc').limit(5).get();
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { }

    return NextResponse.json({
        diagnostics: "Basera Webhook Live",
        recentTasks: tasks,
        env: {
            gemini: !!process.env.GEMINI_API_KEY,
            twilio: !!process.env.TWILIO_AUTH_TOKEN
        },
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: NextRequest) {
    const start = Date.now();
    try {
        const formData = await req.formData();
        const incomingMsg = (formData.get('Body') as string) || '';
        const fromNumber = (formData.get('From') as string) || '';
        const number = fromNumber.replace('whatsapp:', '');

        console.log(`📨 [${number}] Message: "${incomingMsg}"`);

        // 1. Instant Acknowledgment to Twilio (Avoids 5s timeout)
        const twiml = new twilio.twiml.MessagingResponse();

        // --- ASYNC WORK START ---
        // We use a promise wrapper that we DON'T await in the main thread
        const processTask = async () => {
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                const sid = process.env.TWILIO_ACCOUNT_SID;
                const token = process.env.TWILIO_AUTH_TOKEN;

                if (!apiKey || !sid || !token) throw new Error("Missing Env Keys");

                const client = twilio(sid, token);
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: "models/gemini-2.0-flash",
                    generationConfig: { responseMimeType: "application/json" }
                });

                // 2. Lookup Household
                const householdsSnapshot = await adminDb.collection('households')
                    .where('userPhoneNumbers', 'array-contains', number)
                    .limit(1).get();

                if (householdsSnapshot.empty) {
                    console.warn(`❌ [${number}] No household found.`);
                    await client.messages.create({
                        body: "🏡 Basera: We don't recognize this number. Please add it to your profile in the app first!",
                        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER || '+14155238886'}`,
                        to: fromNumber
                    });
                    return;
                }

                const hDoc = householdsSnapshot.docs[0];
                const hData = hDoc.data();
                const user = hData.users?.find((u: any) => u.phoneNumber === number);
                const householdId = hDoc.id;
                console.log(`🏠 [${number}] Found Household: ${householdId}`);

                const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

                // 3. AI Parsing
                let taskData;
                try {
                    const userContext = (hData.users || []).map((u: any) => `${u.name}:${u.id}`).join(', ');
                    const prompt = `Task: "${incomingMsg}". Date: ${istDate}. Users: ${userContext}. Sender: ${user?.name}. JSON: { title: string, priority: "high"|"medium"|"low", assigneeId: string|null, dueDate: YYYY-MM-DD }`;
                    console.log(`🤖 [${number}] Sending to AI: ${prompt}`);

                    const result = await model.generateContent(prompt);
                    const aiResponseText = result.response.text();
                    console.log(`✅ [${number}] AI Response: ${aiResponseText}`);
                    taskData = JSON.parse(aiResponseText);
                } catch (e: any) {
                    console.warn(`⚠️ [${number}] AI Parsing Fallback: ${e.message}`);
                    taskData = { title: incomingMsg, priority: 'medium', assigneeId: null, dueDate: istDate };
                }

                // 4. Save to DB
                const taskId = Math.random().toString(36).substring(2, 11);
                const newTask = {
                    id: taskId, ...taskData,
                    status: 'pending', createdAt: Date.now(), recurrence: 'none'
                };
                console.log(`💾 [${number}] Saving task ${taskId} to household ${householdId}:`, newTask);
                await adminDb.collection('households').doc(householdId).collection('tasks').doc(taskId).set(newTask);
                console.log(`✅ [${number}] Task saved.`);

                // 5. Send Proactive WhatsApp Reply
                let reply = `✅ *${newTask.title}* added!`;
                if (newTask.priority === 'high') reply += `\n🚨 High Priority`;
                if (newTask.assigneeId) {
                    const assignee = hData.users.find((u: any) => u.id === newTask.assigneeId);
                    if (assignee) reply += `\n👤 For: ${assignee.name}`;
                }
                console.log(`💬 [${number}] Sending proactive reply: ${reply}`);
                await client.messages.create({
                    body: reply,
                    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER || '+14155238886'}`,
                    to: fromNumber
                });
                console.log(`✅ [${number}] Processed in ${Date.now() - start}ms`);
            } catch (err: any) {
                console.error(`💥 [${number}] Async Error:`, err.message);
                // Optionally send an error message back to the user
                const sid = process.env.TWILIO_ACCOUNT_SID;
                const token = process.env.TWILIO_AUTH_TOKEN;
                if (sid && token) {
                    const client = twilio(sid, token);
                    await client.messages.create({
                        body: `⚠️ Basera: An error occurred while processing your request. Please try again. (${err.message})`,
                        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER || '+14155238886'}`,
                        to: fromNumber
                    }).catch(e => console.error(`Failed to send error message: ${e.message}`));
                }
            }
        };

        // Trigger the async work without awaiting it for the response
        // On Vercel, we need to use waitUntil to prevent the function from dying
        if ((req as any).waitUntil) {
            (req as any).waitUntil(processTask());
            console.log(`🚀 [${number}] waitUntil engaged.`);
        } else {
            // Fallback for local dev or environments without waitUntil
            processTask();
            console.log(`🚀 [${number}] processTask started without waitUntil.`);
        }

        // Return quickly to Twilio
        return new NextResponse(twiml.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: any) {
        console.error('💥 Webhook Error:', error);
        // Return an empty TwiML response to Twilio to acknowledge receipt
        return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }
}
