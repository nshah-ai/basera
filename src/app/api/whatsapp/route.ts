import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { User } from '@/types';
import twilio from 'twilio';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || 'KA5HX7';

    let tasks: any[] = [];
    try {
        const snapshot = await adminDb.collection('households').doc(code).collection('tasks')
            .orderBy('createdAt', 'desc').limit(5).get();
        tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { }

    return NextResponse.json({
        status: "Basera Webhook Active",
        household: code,
        recentTasks: tasks,
        env: {
            gemini: !!process.env.GEMINI_API_KEY,
            twilio: !!process.env.TWILIO_AUTH_TOKEN
        }
    });
}

export async function POST(req: NextRequest) {
    console.log('--- 📨 Incoming WhatsApp Webhook (Hybrid Parser) ---');
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;

        if (!apiKey || !sid || !token) throw new Error("Missing Credentials");

        const client = twilio(sid, token);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "models/gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const formData = await req.formData();
        const incomingMsg = (formData.get('Body') as string) || '';
        const fromNumber = (formData.get('From') as string) || '';
        const number = fromNumber.replace('whatsapp:', '');

        const messagingResponse = new twilio.twiml.MessagingResponse();

        // 1. Find household by phone number
        const householdsSnapshot = await adminDb.collection('households')
            .where('userPhoneNumbers', 'array-contains', number)
            .limit(1)
            .get();

        if (householdsSnapshot.empty) {
            messagingResponse.message("🏡 Basera: Please add your phone number to your profile in the app first!");
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        const hDoc = householdsSnapshot.docs[0];
        const hData = hDoc.data();
        const user = hData.users?.find((u: any) => u.phoneNumber === number);
        const householdId = hDoc.id;
        const userId = user?.id || 'Shared';

        const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 2. Fetch Recent Pending Tasks for Context (Index-free approach)
        let pendingTasks: any[] = [];
        try {
            const recentTasksSnapshot = await adminDb.collection('households')
                .doc(householdId).collection('tasks')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            pendingTasks = recentTasksSnapshot.docs
                .map(doc => ({ id: doc.id, title: doc.data().title, status: doc.data().status }))
                .filter(t => t.status === 'pending')
                .slice(0, 10);
        } catch (e) {
            console.error('❌ Context Fetch Error:', e);
        }

        // 3. AI Parsing (Synchronous, 4s Timeout)
        let aiResult: any;
        let rawAi = "";
        try {
            const userContext = (hData.users || []).map((u: any) => `${u.name} (ID: ${u.id})`).join(', ');
            const taskContext = pendingTasks.map(t => `- "${t.title}" (ID: ${t.id})`).join('\n');

            const prompt = `
            Context:
            - Message: "${incomingMsg}"
            - Household Users: ${userContext}
            - Pending Tasks:
            ${taskContext || 'None'}
            - Current Date: ${istDate}
            - Sender: ${user?.name || 'User'}

            Task:
            Decide if the user wants to ADD a new task or COMPLETE an existing one. For simple additions like "buy milk", use CREATE. Only use COMPLETE if they explicitly say they are done or finished or marking something as done.
            
            Return JSON:
            {
              "intent": "CREATE" | "COMPLETE",
              "taskId": "ID of matched task if COMPLETE",
              "title": "Clean title",
              "priority": "high" | "medium" | "low",
              "assigneeId": "ID",
              "dueDate": "YYYY-MM-DD"
            }
            `;

            const aiPromise = model.generateContent(prompt);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));

            const result: any = await Promise.race([aiPromise, timeoutPromise]);
            rawAi = (await result.response).text();

            // Basic JSON cleaning in case AI includes md blocks
            const cleanJson = rawAi.replace(/```json/g, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
        } catch (e: any) {
            console.warn('⚠️ AI Error/Timeout:', e.message);
            aiResult = { intent: "CREATE", title: incomingMsg, priority: "medium", assigneeId: null, dueDate: istDate };
        }

        // --- Intent Handling ---
        if (aiResult.intent === 'COMPLETE' && aiResult.taskId) {
            await adminDb.collection('households').doc(householdId).collection('tasks').doc(aiResult.taskId).update({
                status: 'completed',
                completedAt: Date.now()
            });

            messagingResponse.message(`✅ Marked as Done: *${aiResult.title || 'Task'}*`);
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // --- Proceed with CREATE logic ---
        const taskData = aiResult;
        const lowerMsg = incomingMsg.toLowerCase();
        (hData.users || []).forEach((u: any) => {
            const name = u.name.toLowerCase();
            if (lowerMsg.includes(name) && !taskData.assigneeId) {
                taskData.assigneeId = u.id;
            }
        });

        if (!taskData.title || taskData.title.length < 2) taskData.title = incomingMsg;

        const taskId = Math.random().toString(36).substring(2, 11);
        const newTask = {
            id: taskId,
            ...taskData,
            status: 'pending',
            createdAt: Date.now(),
            recurrence: 'none',
            metadata: { via: 'whatsapp', debug: rawAi.substring(0, 100) }
        };

        await adminDb.collection('households').doc(householdId).collection('tasks').doc(taskId).set(newTask);


        // 4. Proactive Nudge to Assignee
        if (newTask.assigneeId && newTask.assigneeId !== userId) {
            const assignee = (hData.users || []).find((u: any) => u.id === newTask.assigneeId);
            if (assignee && assignee.phoneNumber) {
                try {
                    await client.messages.create({
                        from: 'whatsapp:+14155238886', // Twilio Sandbox
                        to: `whatsapp:${assignee.phoneNumber}`,
                        body: `🏡 *Basera Nudge*\n\nHey ${assignee.name}! ${user?.name || 'A partner'} just added a task for you:\n\n*${newTask.title}*\n${newTask.priority === 'high' ? '🚨 High Priority' : ''}`
                    });
                } catch (err: any) {
                    console.error('❌ Nudge failed:', err.message);
                }
            }
        }

        // 5. Reply to Sender
        let responseMsg = `✅ Added: *${newTask.title}*`;
        if (newTask.priority === 'high') responseMsg += `\n🚨 High Priority`;

        if (newTask.assigneeId) {
            const assignee = (hData.users || []).find((u: any) => u.id === newTask.assigneeId);
            if (assignee) {
                responseMsg += `\n👤 Assigned to: ${assignee.name}`;
                if (newTask.assigneeId !== userId) responseMsg += `\n🔔 Nudged them on WhatsApp!`;
            }
        }

        messagingResponse.message(responseMsg);
        return new NextResponse(messagingResponse.toString(), {
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: any) {
        console.error('💥 Webhook Error:', error);
        return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }
}
