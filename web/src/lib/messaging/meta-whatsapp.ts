import type { OutboundMessage, SendResult } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendWhatsAppMessage(
  msg: OutboundMessage,
): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  const to = msg.toE164.replace(/^\+/, "");
  const url = `${GRAPH}/${phoneId}/messages`;
  const body =
    msg.templateName && msg.templateVariables
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: msg.templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: Object.values(msg.templateVariables).map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: msg.body },
        };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      error: json.error?.message ?? `whatsapp_http_${res.status}`,
    };
  }
  const id = json.messages?.[0]?.id;
  if (!id) {
    return { ok: false, error: "whatsapp_no_message_id" };
  }
  return { ok: true, providerMessageId: id, channel: "whatsapp" };
}
