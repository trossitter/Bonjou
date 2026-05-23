import { env } from '../env';

export interface WhatsAppTextMessage {
  to: string;
  body: string;
}

export async function sendWhatsAppText({ to, body }: WhatsAppTextMessage): Promise<{ sent: boolean; providerResponse?: unknown }> {
  if (!env.WHATSAPP_ENABLED) {
    return { sent: false, providerResponse: { demo: true, to, body } };
  }

  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WhatsApp is enabled, but WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing');
  }

  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body }
    })
  });

  const providerResponse = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status} ${JSON.stringify(providerResponse)}`);
  }

  return { sent: true, providerResponse };
}

export function extractTextMessages(payload: any): Array<{ from: string; id?: string; text: string; timestamp?: string; raw: unknown }> {
  const output: Array<{ from: string; id?: string; text: string; timestamp?: string; raw: unknown }> = [];
  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const messages = change?.value?.messages ?? [];
      for (const message of messages) {
        if (message?.type === 'text' && message?.text?.body) {
          output.push({
            from: message.from,
            id: message.id,
            text: message.text.body,
            timestamp: message.timestamp,
            raw: message
          });
        }
      }
    }
  }
  return output;
}
