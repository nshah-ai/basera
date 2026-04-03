import { NextResponse } from 'next/server';
import { sendPeriskopeMessage } from '@/lib/whatsapp-periskope';

export const dynamic = 'force-dynamic';

export async function GET() {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
        return NextResponse.json({ error: 'ADMIN_PHONE not set' }, { status: 500 });
    }

    try {
        console.log(`🧪 Triggering Periskope test for ${adminPhone}...`);

        await sendPeriskopeMessage(
            adminPhone,
            "🚀 *Basera Perisclaw Test*\n\nIf you are reading this, our connection to the Periskope API is working! 🥘✨"
        );

        return NextResponse.json({
            success: true,
            message: `Test message sent to ${adminPhone} via Periskope.`
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            details: error.response?.data || null
        }, { status: 500 });
    }
}
