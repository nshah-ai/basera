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
    console.log('--- 📨 Incoming WhatsApp Webhook (Nudges Logic) ---');
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;

        if (!apiKey || !sid || !token) throw new Error("Missing Credentials (Gemini/Twilio)");

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


        // 1. Find household
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

        // 2. AI Parsing (Synchronous, 4s Timeout)
        let taskData;
        try {
            const userContext = (hData.users || []).map((u: any) => `${u.name} (ID: ${u.id})`).join(', ');
            const prompt = `Task: "${incomingMsg}". Date: ${istDate}. Users: ${userContext}. Sender: ${user?.name || 'User'} (ID: ${userId}). 
            Instruction: If "for [name]" or similar is mentioned, use their ID from the list. 
            JSON schema: { title, priority: "high"|"medium"|"low", assigneeId: string|null, dueDate: string }`;

            const aiPromise = model.generateContent(prompt);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));

            const result: any = await Promise.race([aiPromise, timeoutPromise]);
            taskData = JSON.parse(result.response.text());
        } catch (e: any) {
            console.warn('⚠️ AI Timeout/Error, using fallback:', e.message);
            taskData = { title: incomingMsg, priority: "medium", assigneeId: null, dueDate: istDate };
        }

        // 3. Save to Firestore
        const taskId = Math.random().toString(36).substring(2, 11);
        const newTask = {
            id: taskId,
            ...taskData,
            status: 'pending',
            createdAt: Date.now(),
            recurrence: 'none'
        };

        await adminDb.collection('households').doc(householdId).collection('tasks').doc(taskId).set(newTask);

        // 4. Proactive Nudge to Assignee (if different from sender)
        if (newTask.assigneeId && newTask.assigneeId !== userId) {
            const assignee = (hData.users || []).find((u: any) => u.id === newTask.assigneeId);
            if (assignee && assignee.phoneNumber) {
                try {
                    console.log(`🚀 Sending nudge to ${assignee.name} (${assignee.phoneNumber})`);
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

        // 5. Return TwiML Reply to Sender
        let responseMsg = `✅ Added: *${newTask.title}*`;
        if (newTask.priority === 'high') responseMsg += `\n🚨 High Priority`;
        if (newTask.assigneeId) {
            const assignee = (hData.users || []).find((u: any) => u.id === newTask.assigneeId);
            if (assignee) responseMsg += `\n👤 Assigned to: ${assignee.name}`;
            if (newTask.assigneeId !== userId && assignee) responseMsg += `\n🔔 I've nudged ${assignee.name} on WhatsApp!`;
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
