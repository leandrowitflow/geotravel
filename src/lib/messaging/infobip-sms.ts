import { infobipSmsSender } from "./infobip-config";
import { isPublicHttpsWebhookUrl } from "./infobip-inbound-webhook-url";
import type { OutboundMessage, SendResult } from "./types";

/** Single-line SMS avoids multipart/newline issues on some PT routes. */
export function formatSmsOutboundText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function infobipBaseUrl(): string | null {
  const raw = process.env.INFOBIP_BASE_URL?.trim();
  if (!raw) return null;
  const trimmed = raw.replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type InfobipSmsResponse = {
  messages?: Array<{
    messageId?: string;
    to?: string;
    status?: {
      description?: string;
      name?: string;
      /** e.g. PENDING, REJECTED — HTTP can still be 200 while message is rejected (e.g. no credits). */
      groupName?: string;
      id?: number;
    };
  }>;
  requestError?: {
    serviceException?: { text?: string; message?: string };
    text?: string;
  };
};

export async function sendInfobipSms(msg: OutboundMessage): Promise<SendResult> {
  const baseUrl = infobipBaseUrl();
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  const sender = infobipSmsSender();
  if (!baseUrl || !apiKey || !sender) {
    return { ok: false, error: "infobip_not_configured" };
  }

  const to = msg.toE164.replace(/\D/g, "");
  if (!to) {
    return { ok: false, error: "infobip_invalid_destination" };
  }

  const notifyUrlRaw = process.env.INFOBIP_SMS_NOTIFY_URL?.trim();
  const notifyUrl =
    notifyUrlRaw && isPublicHttpsWebhookUrl(notifyUrlRaw)
      ? notifyUrlRaw
      : undefined;
  if (notifyUrlRaw && !notifyUrl) {
    console.warn(
      "[infobip] INFOBIP_SMS_NOTIFY_URL ignored — must be a public https URL, not localhost.",
    );
  }

  const messagePayload: Record<string, unknown> = {
    sender,
    destinations: [{ to }],
    content: { text: formatSmsOutboundText(msg.body).slice(0, 1600) },
  };
  if (notifyUrl) {
    messagePayload.notifyUrl = notifyUrl;
  }

  const url = `${baseUrl}/sms/3/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ messages: [messagePayload] }),
    });

    const data = (await res.json()) as InfobipSmsResponse;

    if (!res.ok) {
      const errText =
        data.requestError?.serviceException?.text ??
        data.requestError?.serviceException?.message ??
        data.requestError?.text ??
        res.statusText;
      return {
        ok: false,
        error: `infobip_sms_failed: ${errText || res.status}`,
      };
    }

    const first = data.messages?.[0];
    const messageId = first?.messageId;
    if (!messageId) {
      return { ok: false, error: "infobip_sms_failed: missing messageId" };
    }

    const st = first.status;
    const group = st?.groupName?.trim().toUpperCase();
    if (group === "REJECTED") {
      const code = st?.id != null ? ` (code ${st.id})` : "";
      const reason =
        st?.name?.trim() || st?.description?.trim() || "REJECTED";
      return {
        ok: false,
        error: `infobip_sms_rejected:${code} ${reason}`.trim(),
      };
    }

    const status =
      st?.description?.trim() || st?.name?.trim() || undefined;

    return {
      ok: true,
      providerMessageId: messageId,
      channel: "sms",
      smsProviderMeta: {
        destinationDigits: first.to ?? to,
        status,
        statusGroup: st?.groupName?.trim(),
        statusName: st?.name?.trim(),
        smsCount: (first as { details?: { messageCount?: number } }).details
          ?.messageCount,
      },
    };
  } catch (e) {
    const err = e as { message?: string };
    return {
      ok: false,
      error: err.message ?? "infobip_sms_failed",
    };
  }
}
