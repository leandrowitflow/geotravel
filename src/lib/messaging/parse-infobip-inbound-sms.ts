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
};

function digitsToE164(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return null;
  return `+${d}`;
}

function extractFromResult(r: InfobipInboundResult): InfobipInboundSms | null {
  const nestedText =
    r.message && typeof r.message === "object"
      ? (r.message.text ?? "").trim()
      : "";
  const body = (r.cleanText ?? r.text ?? nestedText).trim();
  const fromRaw = (r.from ?? r.sender ?? "").trim();
  if (!fromRaw || !body) return null;
  const fromE164 = fromRaw.startsWith("+")
    ? `+${fromRaw.replace(/\D/g, "")}`
    : digitsToE164(fromRaw);
  if (!fromE164) return null;
  const toDigits = r.to?.replace(/\D/g, "") || undefined;
  return {
    fromE164,
    body,
    providerMessageId: r.messageId?.trim() || undefined,
    toDigits,
  };
}

export function parseInfobipInboundSmsPayload(
  payload: unknown,
): InfobipInboundSms[] {
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  const results = o.results;
  if (!Array.isArray(results)) return [];
  const out: InfobipInboundSms[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const parsed = extractFromResult(item as InfobipInboundResult);
    if (parsed) out.push(parsed);
  }
  return out;
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
