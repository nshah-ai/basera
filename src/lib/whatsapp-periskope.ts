import axios from 'axios';

const PERISKOPE_API_KEY = process.env.PERISKOPE_API_KEY;
const PERISKOPE_PHONE = process.env.PERISKOPE_PHONE;

/**
 * Sends a WhatsApp message via Periskope (Perisclaw)
 * @param to Phone number in international format (e.g. 91XXXXXXXXXX)
 * @param text The message content
 */
export async function sendPeriskopeMessage(to: string, text: string) {
    if (!PERISKOPE_API_KEY || !PERISKOPE_PHONE) {
        console.error('❌ Periskope missing configuration');
        return null;
    }

    try {
        const response = await axios.post(
            'https://api.periskope.app/v1/message/send',
            {
                chat_id: to,
                message: text
            },
            {
                headers: {
                    'Authorization': `Bearer ${PERISKOPE_API_KEY}`,
                    'x-phone': PERISKOPE_PHONE,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Periskope response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('❌ Periskope message error:', error.response?.data || error.message);
        throw error;
    }
}
