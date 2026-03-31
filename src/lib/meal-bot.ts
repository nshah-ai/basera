import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import twilio from 'twilio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

export async function handleMealBotState(
    client: twilio.Twilio,
    householdId: string,
    hData: any,
    user: any,
    incomingMsg: string
): Promise<string | null> {
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
    const result = await model.generateContent(prompt);
    const intent = JSON.parse(result.response.text());

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

        // Simplified Element: Skip strict ingredient check for MVP v0, just assume some missing items to test flow
        await adminDb.collection('households').doc(householdId).update({
            'botState.currentState': 'AWAITING_ORDER_APPROVAL'
        });

        let reply = `✅ Awesome! Lockingly in ${intent.selectedOption}.\n`;
        if (intent.modifiers) reply += `Notes: *${intent.modifiers}*\n\n`;
        reply += `🛒 *Ingredient Check*\nYou may need some fresh veggies (Onion, Tomato, Coriander). \n\n*Should I create a Blinkit checklist for you?* (Reply YES or NO)`;

        return reply;
    }

    return "🤔 I didn't quite catch that. Reply 1, 2, Change, or Skip.";
}

async function handleOrderApproval(client: twilio.Twilio, householdId: string, hData: any, user: any, msg: string, pendingDate: string) {
    const cleanMsg = msg.toLowerCase().trim();

    if (cleanMsg === 'yes' || cleanMsg === 'y' || cleanMsg.includes('create')) {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });

        return `🛒 *Your Blinkit Checklist*\n\n1. Onions (1kg)\n2. Tomatoes (1kg)\n3. Fresh Coriander\n\n📌 Please place the order manually. Reply "Ordered" when done!`;
    }

    if (cleanMsg === 'no' || cleanMsg === 'n' || cleanMsg.includes('skip') || cleanMsg.includes('later')) {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return `👍 Got it! I've saved the meal plan. The cook instructions will be ready tomorrow.`;
    }

    if (cleanMsg === 'ordered') {
        await adminDb.collection('households').doc(householdId).update({ 'botState.currentState': 'IDLE' });
        return `✅ Awesome. Ingredients marked as restocked.`;
    }

    return "Please reply YES to create the checklist, or NO to skip.";
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

    return "Reply YES if the meal was made, or NO if it was skipped.";
}

