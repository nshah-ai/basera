import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { User } from '@/types';
import twilio from 'twilio';
import { handleMealBotState } from '@/lib/meal-bot';
import { generateContentWithFallback } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

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


        const formData = await req.formData();
        const incomingMsg = (formData.get('Body') as string) || '';
        const fromNumber = (formData.get('From') as string) || '';
        const number = fromNumber.replace('whatsapp:', '');

        const messagingResponse = new twilio.twiml.MessagingResponse();

        // 1. Find all households by phone number
        const householdsSnapshot = await adminDb.collection('households')
            .where('userPhoneNumbers', 'array-contains', number)
            .get();

        if (householdsSnapshot.empty) {
            messagingResponse.message("🏡 Basera: Please add your phone number to your profile in the app first!");
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // Pick the most recently created household
        const sortedDocs = householdsSnapshot.docs.sort((a, b) => {
            const timeA = a.data().createdAt?.toMillis() || 0;
            const timeB = b.data().createdAt?.toMillis() || 0;
            return timeB - timeA;
        });

        const hDoc = sortedDocs[0];
        const hData = hDoc.data();
        const user = hData.users?.find((u: any) => u.phoneNumber === number);
        const householdId = hDoc.id;
        const userId = user?.id || 'Shared';

        // 1b. Handle Debug Commands (status, whoami)
        const cleanMsg = incomingMsg.toLowerCase().trim();
        if (cleanMsg === 'status' || cleanMsg === 'whoami' || cleanMsg === 'debug') {
            const statusMsg = `🏠 *Basera Status*\n\n` +
                `📍 Household: *${householdId}*\n` +
                `👤 Profile: *${user?.name || 'Unknown'}*\n` +
                `✅ Connection: Active\n\n` +
                `Try adding a task like: "Buy mangoes high priority"`;

            messagingResponse.message(statusMsg);
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }


        const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1c. Intercept for Meal Bot State Machine
        const mealReply = await handleMealBotState(client, householdId, hData, user, incomingMsg);
        if (mealReply) {
            messagingResponse.message(mealReply);
            return new NextResponse(messagingResponse.toString(), { headers: { 'Content-Type': 'text/xml' } });
        }

        // 2. AI Parsing (Synchronous, 4s Timeout Fallback included)
        let taskData: any;
        let responseText = "";
        try {
            const prompt = `

            You are an intelligent household assistant.
            Extract task details from the message. Return JSON ONLY.
            Fields: title, priority (high/medium/low), assigneeId (map names to IDs), dueDate (YYYY-MM-DD).
            
            Message: "${incomingMsg}"
            Household Context:
            ${JSON.stringify({
                users: hData.users,
                recentTasks: hData.recentTasks || [],
                ingredients: hData.ingredients || []
            })}
            Current Date: ${istDate}
            Sender: ${user?.name || 'User'}
            `;

            responseText = await generateContentWithFallback(prompt, "application/json");
            taskData = JSON.parse(responseText);
        } catch (e: any) {
            console.warn('⚠️ AI Error/Timeout:', e.message);
            responseText = "Timeout or Error";
            taskData = { title: incomingMsg, priority: "medium", assigneeId: null, dueDate: istDate };

        }

        // --- HYBRID MATCHING (Code-based Backup) ---
        // If the AI missed an assignment mentioned in text, we catch it here.
        const lowerMsg = incomingMsg.toLowerCase();
        (hData.users || []).forEach((u: any) => {
            const name = u.name.toLowerCase();
            if (lowerMsg.includes(name) && !taskData.assigneeId) {
                console.log(`🧠 Code Match: Found ${u.name}`);
                taskData.assigneeId = u.id;
                // Basic title cleaning backup
                taskData.title = taskData.title.replace(new RegExp(`assign to ${name}`, 'gi'), '').trim();
                taskData.title = taskData.title.replace(new RegExp(`for ${name}`, 'gi'), '').trim();
                taskData.title = taskData.title.replace(new RegExp(`${name}`, 'gi'), '').trim();
            }
        });

        // Ensure title isn't empty after cleaning
        if (!taskData.title || taskData.title.length < 2) taskData.title = incomingMsg;

        // 3. Save to Firestore
        const taskId = Math.random().toString(36).substring(2, 11);
        const newTask = {
            id: taskId,
            ...taskData,
            status: 'pending',
            createdAt: Date.now(),
            recurrence: 'none',
            metadata: { via: 'whatsapp', debug: responseText.substring(0, 100) }
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
