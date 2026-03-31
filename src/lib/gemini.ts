import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Attempts to generate content using Gemini 2.0 Flash (preferred),
 * with automatic, unconditional fallbacks to 1.5-flash and 1.5-flash-8b on any failure.
 */
export async function generateContentWithFallback(prompt: string, responseMimeType?: string) {
    const config: GenerationConfig = responseMimeType ? { responseMimeType } : {};

    // 1. Try Gemini 2.0 Flash
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: config });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (e20: any) {
        console.warn("❌ Gemini 2.0 Failed:", e20?.message || e20);

        // 2. Fallback to Gemini 1.5 Flash
        try {
            console.log("🔄 Attempting 1.5-flash fallback...");
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: config });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (e15: any) {
            console.error("❌ Gemini 1.5-flash Failed:", e15?.message || e15);

            // 3. Last Resort Fallback to Gemini 1.5 Flash-8B
            try {
                console.log("🔄 Attempting 1.5-flash-8b last resort...");
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b", generationConfig: config });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return response.text();
            } catch (eFinal: any) {
                console.error("❌ All Gemini fallbacks failed.");
                throw eFinal;
            }
        }
    }
}
