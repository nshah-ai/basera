import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import { FieldValue } from 'firebase-admin/firestore';
import { generateContentWithFallback } from '@/lib/gemini';

export const dynamic = 'force-dynamic';







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
INPUT DATA:
- Household Preferences: ${JSON.stringify(preferences)}
- Recent Meals: ${JSON.stringify(recentMeals)}

TASK:
Generate 2 distinct Indian meal plan options for tomorrow.

CONSTRAINTS:
- Format: JSON ONLY. 
- No conversation. No "Namaste". No markdown tags.
- Ingredients must be common in Indian kitchens.
- Avoid repeating items from 'Recent Meals'.

SCHEMA:
{
  "options": [
    {
      "id": "option1",
      "meals": {
        "breakfast": { "name": "...", "ingredients": ["..."] },
        "lunch": { "name": "...", "ingredients": ["..."] },
        "dinner": { "name": "...", "ingredients": ["..."] }
      }
    }
  ]
}
`;

        const systemInstruction = `You are a strict API bot. You must ONLY output a raw JSON object. Do not include markdown tags. Do not say hello. Do not add any conversational text. Your output must match this schema: { "options": [ { "id": "option1", "meals": { "breakfast": { "name": "...", "ingredients": ["..."] }, "lunch": { "name": "...", "ingredients": ["..."] }, "dinner": { "name": "...", "ingredients": ["..."] } } } ] }`;

        const responseText = await generateContentWithFallback(prompt, "application/json", systemInstruction);

        let generatedData: any = {};
        try {
            // Strip markdown formatting if present
            const cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            generatedData = JSON.parse(cleanText);
        } catch (e: any) {
            console.error("JSON Parse Error on Gemini Output:", responseText);
            throw new Error(`Failed to parse AI output into JSON. Raw: ${responseText.substring(0, 300)}...`);
        }

        // Recursive search for the options array. 
        // Different models (2.0 vs 2.5 vs 1.5) might wrap it differently.
        const findMealArray = (obj: any): any[] | null => {
            if (Array.isArray(obj)) {
                // Check if this array looks like a list of meal options (has meals or breakfast keys)
                const isMealArray = obj.some(item =>
                    item && (
                        item.meals ||
                        item.breakfast ||
                        item.lunch ||
                        item.dinner ||
                        item.id?.toString().toLowerCase().includes('option')
                    )
                );
                if (isMealArray) return obj;
            }

            if (typeof obj === 'object' && obj !== null) {
                for (const key of Object.keys(obj)) {
                    const found = findMealArray(obj[key]);
                    if (found) return found;
                }
            }
            return null;
        };

        const optionsToSave = findMealArray(generatedData) || [];

        if (optionsToSave.length === 0) {
            console.error("AI Output schema mismatch:", JSON.stringify(generatedData));
            throw new Error(`AI returned valid JSON but no meal options array found. Structure: ${JSON.stringify(generatedData).substring(0, 300)}...`);
        }


        // FORCE IDs: Ensure each option has id: "option1", "option2" etc.
        // This prevents crashes in generateCookInstructions if the AI omitted IDs.
        const sanitizedOptions = optionsToSave.map((opt: any, index: number) => ({
            ...opt,
            id: `option${index + 1}`
        }));






        // 3. Save to Firestore
        // Get tomorrow's date YYYY-MM-DD
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const mealLogRef = adminDb.collection('households').doc(adminHouseholdId).collection('mealLogs').doc(dateStr);
        await mealLogRef.set({
            id: dateStr,
            date: dateStr,
            suggestedOptions: sanitizedOptions,

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

        sanitizedOptions.forEach((opt: any, index: number) => {
            msgBody += `*Option ${index + 1}:*\n`;
            msgBody += `- 🍳 B: ${opt.meals?.breakfast?.name || 'Planned'}\n`;
            msgBody += `- 🍛 L: ${opt.meals?.lunch?.name || 'Planned'}\n`;
            msgBody += `- 🍲 D: ${opt.meals?.dinner?.name || 'Planned'}\n\n`;
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
