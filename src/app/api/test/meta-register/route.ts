import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
        return NextResponse.json({ error: 'Missing Meta env variables' }, { status: 500 });
    }

    try {
        console.log(`🔨 Registering Phone Number ID ${META_PHONE_NUMBER_ID} with Meta...`);

        const response = await axios.post(
            `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/register`,
            {
                messaging_product: 'whatsapp',
                pin: '123456'
            },
            {
                headers: {
                    'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: `Registration successful for ${META_PHONE_NUMBER_ID}.`,
            data: response.data
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.response?.data || null
        }, { status: 500 });
    }
}
