import { NextResponse } from 'next/server';
import axios from 'axios';
import { sendMetaMessage } from '@/lib/whatsapp-meta';

export const dynamic = 'force-dynamic';

export async function GET() {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
        return NextResponse.json({ error: 'ADMIN_PHONE not set' }, { status: 500 });
    }

    try {
        console.log(`🧪 Triggering Meta Cloud API TEMPLATE test for ${adminPhone}...`);

        // Use the official 'hello_world' template which is allowed even before a session starts
        const response = await axios.post(
            `https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: adminPhone,
                type: 'template',
                template: {
                    name: 'hello_world',
                    language: { code: 'en_US' }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: `Template 'hello_world' sent to ${adminPhone}.`,
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
