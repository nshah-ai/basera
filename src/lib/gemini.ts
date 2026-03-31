import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateContentWithFallback(prompt: string, responseMimeType?: string) {
    const config: GenerationConfig = responseMimeType ? { responseMimeType } : {};

    // 1. Try Gemini 2.0 Flash (User's Preference)
    try {
        const model20 = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: config });
        const result = await model20.generateContent(prompt);
        return result.response.text();
    } catch (primaryError: any) {
        const errorStr = String(primaryError).toLowerCase() +
            (primaryError?.message?.toLowerCase() || '') +
            JSON.stringify(primaryError).toLowerCase();

        const isQuotaError = errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('limit');

        if (isQuotaError) {
            console.warn("⚠️ Gemini 2.0 Quota Exhausted. Attempting 1.5 Flash Fallback...");
            try {
                // 2. Try Gemini 1.5 Flash (Reliable Fallback)
                const model15 = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: config });
                const result = await model15.generateContent(prompt);
                return result.response.text();
            } catch (fallbackError: any) {
                console.error("⚠️ Gemini 1.5 Fallback Failed. Attempting 1.5 Flash-8B...");
                try {
                    // 3. Try Gemini 1.5 Flash-8B (High Throughput Backup)
                    const model8b = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b", generationConfig: config });
                    const result = await model8b.generateContent(prompt);
                    return result.response.text();
                } catch (finalError) {
                    console.error("❌ All Gemini fallbacks failed.");
                    throw finalError;
                }
            }
        }
        // If it's not a quota error, throw the original error
        throw primaryError;
    }
}
