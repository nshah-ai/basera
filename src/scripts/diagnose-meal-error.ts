import { adminDb } from '../lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// MANUALLY LOAD ENV
function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
        }
    });
}
loadEnv();


async function diagnose() {
    const householdId = 'KA5HX7';
    console.log('--- DIAGNOSING HOUSEHOLD KA5HX7 ---');

    const hDoc = await adminDb.collection('households').doc(householdId).get();
    if (!hDoc.exists) {
        console.error('Household not found!');
        return;
    }

    const hData = hDoc.data();
    console.log('Bot State:', JSON.stringify(hData.botState, null, 2));

    const pendingDate = hData.botState?.pendingMealDate;
    if (!pendingDate) {
        console.error('No pending meal date in botState!');
        return;
    }

    console.log(`\n--- Inspecting Meal Log for ${pendingDate} ---`);
    const logDoc = await adminDb.collection('households').doc(householdId).collection('mealLogs').doc(pendingDate).get();

    if (!logDoc.exists) {
        console.error(`Meal log for ${pendingDate} does NOT exist!`);
        return;
    }

    const logData = logDoc.data();
    console.log('Selected Option ID:', logData.selectedOptionId);
    console.log('Suggested Options Present:', !!logData.suggestedOptions);
    console.log('Suggested Options Count:', logData.suggestedOptions?.length || 0);

    if (logData.suggestedOptions && logData.selectedOptionId) {
        const found = logData.suggestedOptions.find((o: any) => o.id === logData.selectedOptionId);
        console.log('Selected Option found in array:', !!found);
        if (found) {
            console.log('Meals present:', !!found.meals);
            if (found.meals) {
                console.log('Meals keys:', Object.keys(found.meals));
            }
        }
    }
}

diagnose().catch(console.error);
