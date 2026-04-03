import { NextResponse } from 'next/server';
import { sendMetaMessage } from '@/lib/whatsapp-meta';

export const dynamic = 'force-dynamic';

export async function GET() {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
        return NextResponse.json({ error: 'ADMIN_PHONE not set' }, { status: 500 });
    }

    try {
        console.log(`🧪 Triggering Meta Cloud API test for ${adminPhone}...`);

        await sendMetaMessage(
            adminPhone,
            "🚀 *Basera Meta Cloud API Test*\n\nThis is a private, official message from your own Meta Developer App! 🥘✨"
        );

        return NextResponse.json({
            success: true,
            message: `Test message sent to ${adminPhone} via Meta.`
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.response?.data || null
        }, { status: 500 });
    }
}
