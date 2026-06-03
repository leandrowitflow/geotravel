import { canonicalizeInboundWebhookFrom } from "@/lib/orchestration/resolve-contact-for-inbound";

/** Infobip MO_JSON_2 / inbound SMS webhook payload (see Infobip “Receive SMS” docs). */
export type InfobipInboundSms = {
  fromE164: string;
  body: string;
  providerMessageId?: string;
  toDigits?: string;
};

type InfobipInboundResult = {
  from?: string;
  sender?: string;
  to?: string;
  text?: string;
  cleanText?: string;
  messageId?: string;
  message?: { text?: string; type?: string };
  content?: { text?: string };
};

function firstInboundBodyText(...parts: (string | undefined)[]): string {
  for (const part of parts) {
    const t = (part ?? "").trim();
    if (t) return t;
  }
  return "";
}

function extractFromResult(r: InfobipInboundResult): InfobipInboundSms | null {
  const nestedText =
    r.message && typeof r.message === "object"
      ? (r.message.text ?? "").trim()
      : "";
  const contentText =
    r.content && typeof r.content === "object"
      ? (r.content.text ?? "").trim()
      : "";
  const body = firstInboundBodyText(
    r.cleanText,
    r.text,
    nestedText,
    contentText,
  );
  const fromRaw = (r.from ?? r.sender ?? "").trim();
  if (!fromRaw || !body) return null;
  const fromE164 = canonicalizeInboundWebhookFrom(fromRaw);
  if (!fromE164) return null;
  const toDigits = r.to?.replace(/\D/g, "") || undefined;
  return {
    fromE164,
    body,
    providerMessageId: r.messageId?.trim() || undefined,
    toDigits,
  };
}

function parseResultsArray(results: unknown[]): InfobipInboundSms[] {
  const out: InfobipInboundSms[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const parsed = extractFromResult(item as InfobipInboundResult);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseInfobipInboundSmsPayload(
  payload: unknown,
): InfobipInboundSms[] {
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  const results = o.results;
  if (Array.isArray(results)) {
    return parseResultsArray(results);
  }
  const messages = o.messages;
  if (Array.isArray(messages)) {
    return parseResultsArray(messages);
  }
  const single = extractFromResult(o as InfobipInboundResult);
  return single ? [single] : [];
}

/** Keys present when parser returns empty — helps debug Infobip config. */
export function describeInfobipInboundPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "non-object body";
  const o = payload as Record<string, unknown>;
  const keys = Object.keys(o).join(",");
  const n = Array.isArray(o.results) ? o.results.length : 0;
  const first = Array.isArray(o.results) ? o.results[0] : null;
  const firstKeys =
    first && typeof first === "object"
      ? Object.keys(first as object).join(",")
      : "";
  return `keys=${keys} results=${n} first=${firstKeys}`;
}
