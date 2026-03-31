import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateContentWithFallback(prompt: string, responseMimeType?: string) {
    const config: GenerationConfig = responseMimeType ? { responseMimeType } : {};

    // 1. Try Gemini 2.0 Flash (User's Preference)
    try {
        const model20 = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: config });
        const result = await model20.generateContent(prompt);
        return result.response.text();
    } catch (error: any) {
        // If it's a 429 (Quota) error, fallback to 1.5
        if (error?.message?.includes('429') || error?.message?.includes('Quota')) {
            console.warn("⚠️ Gemini 2.0 Quota Exhausted. Falling back to 1.5 Flash...");
            const model15 = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: config });
            const result = await model15.generateContent(prompt);
            return result.response.text();
        }
        // If it's some other error, rethrow
        throw error;
    }
}
