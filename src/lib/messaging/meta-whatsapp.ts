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

/** Meta: same-user throughput (e.g. 131056) — backoff 4^attempt seconds per platform guidance. */
function isWhatsAppRateOrThroughputError(
  status: number,
  code: number | undefined,
): boolean {
  if (status === 429) return true;
  if (code === 131056) return true;
  return false;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
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
        recipient_type: "individual",
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
        recipient_type: "individual",
        to,
        type: "text" as const,
        text: {
          preview_url: Boolean(msg.linkPreview),
          body: msg.body,
        },
      };

  const maxAttempts = 4;
  let lastErr = "whatsapp_unknown_error";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      error?: { message: string; code?: number };
    };

    if (res.ok) {
      const id = json.messages?.[0]?.id;
      if (!id) {
        return { ok: false, error: "whatsapp_no_message_id" };
      }
      return { ok: true, providerMessageId: id, channel: "whatsapp" };
    }

    const code = json.error?.code;
    const msgText = json.error?.message ?? `whatsapp_http_${res.status}`;
    lastErr = msgText;

    if (
      isWhatsAppRateOrThroughputError(res.status, code) &&
      attempt < maxAttempts - 1
    ) {
      await sleep(Math.pow(4, attempt) * 1000);
      continue;
    }

    return { ok: false, error: msgText };
  }

  return { ok: false, error: lastErr };
}
