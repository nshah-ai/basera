import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import { generateContentWithFallback } from '@/lib/gemini';
import { FieldValue } from 'firebase-admin/firestore';



export async function handleMealBotState(
    client: twilio.Twilio,
    householdId: string,
    hData: any,
    user: any,
    incomingMsg: string
): Promise<string | null> {
    // STRICT ISOLATION: Only allow for the configured admin household
    if (householdId !== (process.env.NEXT_PUBLIC_ADMIN_HOUSEHOLD_ID || 'KA5HX7')) {
        return null;
    }

    const state = hData.botState?.currentState;

    if (!state || state === 'IDLE') return null; // Not in meal flow

    const pendingDate = hData.botState?.pendingMealDate;
    if (!pendingDate) return null;

    try {
        if (state === 'AWAITING_MEAL_SELECTION') {
            return await handleSelection(client, householdId, hData, user, incomingMsg, pendingDate);
        } else if (state === 'AWAITING_ORDER_APPROVAL') {
            return await handleOrderApproval(client, householdId, hData, user, incomingMsg, pendingDate);
        } else if (state === 'AWAITING_EXECUTION_CHECK') {
            return await handleExecutionCheck(client, householdId, hData, user, incomingMsg, pendingDate);
        }

    } catch (e) {
        console.error("Meal Bot Error:", e);
        return "⚠️ Sorry, I hit an error processing that meal request.";
    }

    return null;
}

async function handleSelection(client: twilio.Twilio, householdId: string, hData: any, user: any, msg: string, pendingDate: string) {
    // 1. Parse Intent with LLM
    const prompt = `
    User replied to a meal selection prompt. 
    Message: "${msg}"
    
    Determine their intent. Return JSON ONLY matching this schema:
    {
       "action": "SELECT" | "CHANGE" | "SKIP" | "UNKNOWN",
       "selectedOption": "option1" | "option2" | null,
       "modifiers": "Any specific instructions or changes they requested, else null"
    }
    `;
    const responseText = await generateContentWithFallback(prompt, "application/json");
    const intent = JSON.parse(responseText);


    if (intent.action === 'SKIP') {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return "No problem! I've skipped meal planning for tomorrow. 🥘";
    }

    if (intent.action === 'CHANGE') {
        return "🔄 I am regenerating options... (Note: Generation not yet wired to this button in MVP, just reply 1 or 2 for now!)";
    }

    if (intent.action === 'SELECT' && intent.selectedOption) {
        // Save selection
        const mealLogRef = adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate);
        await mealLogRef.update({
            selectedOptionId: intent.selectedOption,
            modifiers: intent.modifiers || null
        });

        // Simplified Flow: Skip grocery flow for MVP, go straight to instructions
        await adminDb.collection('households').doc(householdId).update({
            'botState.currentState': 'IDLE'
        });

        const selectedOptionData = hData.botState?.suggestedOptions?.find((o: any) => o.id === intent.selectedOption);
        const selectedMealNames = selectedOptionData ?
            `${selectedOptionData.meals.breakfast.name}, ${selectedOptionData.meals.lunch.name}, and ${selectedOptionData.meals.dinner.name}` :
            'the meals';

        await notifyPartners(client, hData, user.phoneNumber,
            `🥘 *${user.name}* just selected ${intent.selectedOption} for tomorrow!\nMenu: ${selectedMealNames}.`
        );

        // Generate and send instructions immediately
        generateCookInstructions(client, householdId, hData, user, pendingDate);

        let reply = `✅ Awesome! Locking in ${intent.selectedOption}.\n`;
        if (intent.modifiers) reply += `Notes: *${intent.modifiers}*\n\n`;
        reply += `👨‍🍳 I've generated the recipes for your cook. Sending them over now!`;

        return reply;
    }


    return "🤔 I didn't quite catch that. Reply 1, 2, Change, or Skip.";
}

async function handleOrderApproval(client: twilio.Twilio, householdId: string, hData: any, user: any, msg: string, pendingDate: string) {
    const cleanMsg = msg.toLowerCase().trim();

    if (cleanMsg === 'yes' || cleanMsg === 'y' || cleanMsg.includes('create')) {
        // STICKY STATE: Do not set to IDLE yet. We stay in AWAITING_ORDER_APPROVAL 
        // while the user places the order.
        await adminDb.collection('households').doc(householdId).update({
            'botState.lastUpdated': FieldValue.serverTimestamp()
        });

        await notifyPartners(client, hData, user.phoneNumber,
            `🛒 *${user.name}* has just confirmed the grocery order for tomorrow's meals!`
        );

        return `🛒 *Your Grocery Checklist*\n\n1. Onions (1kg)\n2. Tomatoes (1kg)\n3. Fresh Coriander\n\n📌 Please place the order manually via Blinkit, Instacart, etc. Reply *Ordered* when done!`;
    }


    if (cleanMsg === 'no' || cleanMsg === 'n' || cleanMsg.includes('skip') || cleanMsg.includes('later')) {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });

        await notifyPartners(client, hData, user.phoneNumber,
            `✅ *${user.name}* confirmed we skip ingredients/ready to cook for tomorrow's plan.`
        );

        // Generate Cook Instructions
        await generateCookInstructions(client, householdId, hData, user, pendingDate);
        return `👍 Got it! I've saved the meal plan. Check the message above for the cook instructions.`;
    }

    if (cleanMsg === 'ordered' || cleanMsg === 'placed' || cleanMsg === 'confirm' || cleanMsg === 'done') {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });

        await notifyPartners(client, hData, user.phoneNumber,
            `🛒 *${user.name}* has just confirmed the grocery order for tomorrow's meals!`
        );

        // Generate Cook Instructions
        await generateCookInstructions(client, householdId, hData, user, pendingDate);
        return `✅ Awesome. Ingredients marked as restocked. Check the message above for the cook instructions.`;
    }

    // TRANSPARENT STATE: If message doesn't match meal flow keywords, return null.
    // This allows the main Task Bot to handle it as a regular task.
    return null;

}

async function generateCookInstructions(client: twilio.Twilio, householdId: string, hData: any, user: any, pendingDate: string) {
    try {
        const mealLogDoc = await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).get();
        if (!mealLogDoc.exists) return;
        const mealData = mealLogDoc.data();

        if (!mealData || !mealData.selectedOptionId || !mealData.suggestedOptions) return;

        // DEFENSIVE FIND: Try ID first, then fallback to index
        let selectedOption = mealData.suggestedOptions.find((o: any) => o.id === mealData.selectedOptionId);

        if (!selectedOption) {
            console.log(`🔍 ID search failed for ${mealData.selectedOptionId}. trying index fallback...`);
            const match = mealData.selectedOptionId.match(/\d+/);
            if (match) {
                const index = parseInt(match[0]) - 1;
                selectedOption = mealData.suggestedOptions[index];
            }
        }

        if (!selectedOption) {
            console.error('❌ Could not find selected option in list.');
            return;
        }

        const cookSkillLevel = user.cookSkillLevel || 'medium';

        // Robust property access with fallbacks
        const bName = selectedOption.meals?.breakfast?.name || 'Breakfast';
        const lName = selectedOption.meals?.lunch?.name || 'Lunch';
        const dName = selectedOption.meals?.dinner?.name || 'Dinner';

        const prompt = `
Generate concise, forwardable WhatsApp cooking instructions for a home cook with skill level: ${cookSkillLevel}.
The meals are:
- Breakfast: ${bName}
- Lunch: ${lName}
- Dinner: ${dName}

Modifiers/Notes from user: ${mealData.modifiers || 'None'}

Format strictly for WhatsApp (bold, italics, lists). 
Limit to 5-7 clear steps total. It MUST be extremely actionable.
Example:
👨‍🍳 *Today's Menu*
...
`;

        const instructions = await generateContentWithFallback(prompt);

        if (user.phoneNumber) {
            await client.messages.create({
                from: 'whatsapp:+14155238886',
                to: `whatsapp:${user.phoneNumber}`,
                body: instructions
            });
        }
    } catch (e: any) {
        console.error("Cook Instructions Generation Failed:", e.message);
        // Fail gracefully: send a simple confirmation since the ⚠️ error emoji is discouraging
        if (user.phoneNumber) {
            await client.messages.create({
                from: 'whatsapp:+14155238886',
                to: `whatsapp:${user.phoneNumber}`,
                body: "✅ *Meal plan confirmed!* I'll have the instructions ready shortly."
            });
        }
    }
}



async function handleExecutionCheck(client: twilio.Twilio, householdId: string, hData: any, user: any, msg: string, pendingDate: string) {
    const cleanMsg = msg.toLowerCase().trim();

    if (cleanMsg === 'yes' || cleanMsg === 'y' || cleanMsg.includes('made')) {
        await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).update({
            executed: true
        });
        return `Awesome! How was it? Reply 👍 or 👎.`;
    }

    if (cleanMsg === 'no' || cleanMsg === 'n' || cleanMsg.includes('skip')) {
        await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).update({
            executed: false
        });
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return `Got it! I've logged it as skipped. Next time I'll suggest something simpler.`;
    }

    if (msg.includes('👍') || cleanMsg.includes('good') || cleanMsg.includes('great')) {
        await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).update({
            satisfaction: 'thumb_up'
        });
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return `Glad to hear! I'll remember you liked that one.`;
    }

    if (msg.includes('👎') || cleanMsg.includes('bad')) {
        await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).update({
            satisfaction: 'thumb_down'
        });
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return `Noted! I won't suggest that combination again for a while.`;
    }

    // TRANSPARENT STATE: If message is long or doesn't match feedback keywords, return null.
    // This allows the main Task Bot to handle it (e.g. "Induction cooker fix").
    return null;
}


async function notifyPartners(client: twilio.Twilio, hData: any, senderNumber: string, message: string) {
    const users = hData.users || [];
    for (const u of users) {
        if (u.phoneNumber && u.phoneNumber !== senderNumber) {
            try {
                await client.messages.create({
                    from: 'whatsapp:+14155238886',
                    to: `whatsapp:${u.phoneNumber}`,
                    body: message
                });
            } catch (e: any) {
                console.error("Partner Notify Error:", e?.message);
            }
        }
    }
}



