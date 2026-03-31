import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
    try {
        const apiKey = process.env.GEMINI_API_KEY!;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        return NextResponse.json({
            apiKeyConfigured: !!apiKey,
            apiKeyPrefix: apiKey ? `${apiKey.substring(0, 6)}...` : 'none',
            models: data.models || data
        });
    } catch (error: any) {

        return NextResponse.json({ error: error.message });
    }
}
