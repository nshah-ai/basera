import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import { FieldValue } from 'firebase-admin/firestore';
import { generateContentWithFallback } from '@/lib/gemini';






export async function GET(req: NextRequest) {
    const url = req.url;
    const isTest = url.includes('test=true') || url.includes('test%3Dtrue') || url.includes('pass=true');
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow if test flag is present OR if valid auth header exists
    const isAuthorized = isTest || (authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
        return new NextResponse(`Unauthorized (isTest: ${isTest}, hasAuth: ${!!authHeader}, nodeEnv: ${process.env.NODE_ENV}, url: ${url})`, { status: 401 });
    }





    const adminHouseholdId = process.env.NEXT_PUBLIC_ADMIN_HOUSEHOLD_ID || 'KA5HX7';

    if (!adminHouseholdId) {
        return NextResponse.json({ error: 'No admin household ID configured' }, { status: 400 });
    }

    try {
        const hDoc = await adminDb.collection('households').doc(adminHouseholdId).get();
        if (!hDoc.exists) return NextResponse.json({ error: 'Household not found' }, { status: 404 });

        const hData = hDoc.data();
        const users = hData?.users || [];

        // 1. Fetch Context (Profiles, Ingredients, Recent Meals)
        const recentMealsSnapshot = await adminDb.collection('households').doc(adminHouseholdId).collection('mealLogs')
            .orderBy('date', 'desc').limit(5).get();
        const recentMeals = recentMealsSnapshot.docs.map(d => d.data());

        // Extract preferences
        const preferences = users.map((u: any) => ({
            name: u.name,
            dietaryType: u.dietaryType || 'any',
            dislikes: u.dislikes || [],
            cookSkillLevel: u.cookSkillLevel || 'medium'
        }));

        // 2. Generate Options via Gemini Fallback
        const prompt = `
You are an expert Indian home chef and meal planner...
`;
        const responseText = await generateContentWithFallback(prompt, "application/json");
        let generatedData: any = {};
        try {
            // Strip markdown formatting if present
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            generatedData = JSON.parse(cleanText);

        } catch (e: any) {
            console.error("JSON Parse Error on Gemini Output:", responseText);
            throw new Error("Failed to parse AI meal suggestions into JSON.");
        }

        // Deep search for the options array. 
        // Different models (2.0 vs 2.5 vs 1.5) might wrap it differently.
        let optionsToSave: any[] = [];

        if (Array.isArray(generatedData)) {
            // The AI returned the array directly
            optionsToSave = generatedData;
        } else if (generatedData?.options && Array.isArray(generatedData.options)) {
            // Standard format
            optionsToSave = generatedData.options;
        } else if (generatedData?.meals && Array.isArray(generatedData.meals)) {
            // Alternate format
            optionsToSave = generatedData.meals;
        } else {
            // Hunt for any array in the root object
            for (const key in generatedData) {
                if (Array.isArray(generatedData[key]) && generatedData[key].length > 0) {
                    optionsToSave = generatedData[key];
                    break;
                }
            }
        }

        if (optionsToSave.length === 0) {
            console.error("AI Output schema mismatch:", JSON.stringify(generatedData));
            throw new Error("AI returned a valid JSON but no array of meal options could be found.");
        }




        // 3. Save to Firestore
        // Get tomorrow's date YYYY-MM-DD
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const mealLogRef = adminDb.collection('households').doc(adminHouseholdId).collection('mealLogs').doc(dateStr);
        await mealLogRef.set({
            id: dateStr,
            date: dateStr,
            suggestedOptions: optionsToSave,

            createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Update Bot State
        await hDoc.ref.update({
            'botState.currentState': 'AWAITING_MEAL_SELECTION',
            'botState.lastUpdated': FieldValue.serverTimestamp(),
            'botState.pendingMealDate': dateStr
        });


        // 4. Send WhatsApp Messages
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const formattedDate = tomorrow.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit' });

        let msgBody = `🥘 *Time to plan meals for tomorrow, ${formattedDate}!*\n\n`;

        optionsToSave.forEach((opt: any, index: number) => {

            msgBody += `*Option ${index + 1}:*\n`;
            msgBody += `- 🍳 B: ${opt.meals.breakfast.name}\n`;
            msgBody += `- 🍛 L: ${opt.meals.lunch.name}\n`;
            msgBody += `- 🍲 D: ${opt.meals.dinner.name}\n\n`;
        });
        msgBody += `Reply *1*, *2*, *Change*, or *Skip*.\n_(You can add notes like "1 but breakfast for 1 person")_`;

        let messagesSent = 0;
        for (const userData of users) {
            if (userData.phoneNumber) {
                await client.messages.create({
                    from: 'whatsapp:+14155238886', // Sandbox Number
                    to: `whatsapp:${userData.phoneNumber}`,
                    body: msgBody
                });
                messagesSent++;
            }
        }

        return NextResponse.json({ success: true, date: dateStr, messagesSent });

    } catch (error: any) {
        console.error('Plan Meals Error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error?.message || 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        }, { status: 500 });
    }

}
