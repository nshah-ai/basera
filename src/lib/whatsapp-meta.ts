import axios from 'axios';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

/**
 * Sends a WhatsApp message via official Meta Cloud API
 * @param to Phone number in international format (e.g. 91XXXXXXXXXX)
 * @param text The message content
 */
export async function sendMetaMessage(to: string, text: string) {
    if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
        console.warn('⚠️ Meta Cloud API missing configuration, falling back to console log');
        console.log(`[META MOCK] To: ${to}, Message: ${text}`);
        return null;
    }

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            },
            {
                headers: {
                    'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Meta API response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('❌ Meta API message error:', error.response?.data || error.message);
        throw error;
    }
}
