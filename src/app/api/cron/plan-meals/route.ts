import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FieldValue } from 'firebase-admin/firestore';


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET(req: NextRequest) {
    // Basic security check for CRON trigger
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new NextResponse('Unauthorized', { status: 401 });
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

        // 2. Generate Options via Gemini
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an expert Indian home chef and meal planner. 
Plan 2 distinct daily meal options (Breakfast, Lunch, Dinner) for tomorrow.

Consider these user preferences:
${JSON.stringify(preferences, null, 2)}

And avoid repeating these recent meals:
${JSON.stringify(recentMeals, null, 2)}

Return ONLY a JSON object matching this schema:
{
  "options": [
    {
      "id": "option1",
      "meals": {
        "breakfast": { "name": "Meal name", "ingredients": ["ing1", "ing2"] },
        "lunch": { "name": "Meal name", "ingredients": ["ing1", "ing2"] },
        "dinner": { "name": "Meal name", "ingredients": ["ing1", "ing2"] }
      }
    },
    {
      "id": "option2",
      "meals": {
        "breakfast": { "name": "...", "ingredients": ["..."] },
        "lunch": { "name": "...", "ingredients": ["..."] },
        "dinner": { "name": "...", "ingredients": ["..."] }
      }
    }
  ]
}
`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const generatedData = JSON.parse(responseText);

        // 3. Save to Firestore
        // Get tomorrow's date YYYY-MM-DD
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const mealLogRef = adminDb.collection('households').doc(adminHouseholdId).collection('mealLogs').doc(dateStr);
        await mealLogRef.set({
            id: dateStr,
            date: dateStr,
            suggestedOptions: generatedData.options,
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

        let msgBody = `🥘 *Time to plan meals for tomorrow!*\n\n`;
        generatedData.options.forEach((opt: any, index: number) => {
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

    } catch (error) {
        console.error('Plan Meals Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
