import type { OutboundMessage, SendResult } from "./types";

function graphBaseUrl(): string {
  const ver =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";
  return `https://graph.facebook.com/${ver}`;
}

function defaultTemplateLanguage(): string {
  return (
    process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE?.trim() || "en_US"
  );
}

export async function sendWhatsAppMessage(
  msg: OutboundMessage,
): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  const to = msg.toE164.replace(/^\+/, "");
  const url = `${graphBaseUrl()}/${phoneId}/messages`;
  const lang =
    msg.templateLanguageCode?.trim() || defaultTemplateLanguage();

  const vars = msg.templateVariables;
  const hasVars = vars && Object.keys(vars).length > 0;

  const body = msg.templateName
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template" as const,
        template: hasVars
          ? {
              name: msg.templateName,
              language: { code: lang },
              components: [
                {
                  type: "body" as const,
                  parameters: Object.values(vars!).map((text) => ({
                    type: "text" as const,
                    text,
                  })),
                },
              ],
            }
          : {
              name: msg.templateName,
              language: { code: lang },
            },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text" as const,
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
