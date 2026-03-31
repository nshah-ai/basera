import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Attempts to generate content using Gemini 2.0 Flash (preferred),
 * with automatic, unconditional fallbacks to 1.5-flash and 1.5-flash-8b on any failure.
 */
export async function generateContentWithFallback(prompt: string, responseMimeType?: string, systemInstruction?: string) {
    const config: GenerationConfig = responseMimeType ? { responseMimeType } : {};

    // 1. Try Gemini 2.0 Flash
    try {
        const modelInfo = systemInstruction
            ? { model: "gemini-2.0-flash", generationConfig: config, systemInstruction }
            : { model: "gemini-2.0-flash", generationConfig: config };

        const model = genAI.getGenerativeModel(modelInfo);
        const result = await model.generateContent(prompt);

        const response = await result.response;
        return response.text();
    } catch (e20: any) {
        console.warn("❌ Gemini 2.0 Failed:", e20?.message || e20);

        // 2. Fallback to Gemini 2.5 Flash
        try {
            console.log("🔄 Attempting 2.5-flash fallback...");
            const modelInfo = systemInstruction
                ? { model: "gemini-2.5-flash", generationConfig: config, systemInstruction }
                : { model: "gemini-2.5-flash", generationConfig: config };
            const model = genAI.getGenerativeModel(modelInfo);
            const result = await model.generateContent(prompt);

            const response = await result.response;
            return response.text();
        } catch (e25: any) {
            console.error("❌ Gemini 2.5-flash Failed:", e25?.message || e25);

            // 3. Last Resort Fallback to Gemini Flash Latest (1.5)
            try {
                console.log("🔄 Attempting gemini-flash-latest fallback...");
                const modelInfo = systemInstruction
                    ? { model: "gemini-flash-latest", generationConfig: config, systemInstruction }
                    : { model: "gemini-flash-latest", generationConfig: config };
                const model = genAI.getGenerativeModel(modelInfo);
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
