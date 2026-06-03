/** Production app host (Vercel). Used when env still points at localhost. */
export const GEOTRAVEL_PRODUCTION_APP_ORIGIN =
  "https://geotravel-eta.vercel.app";

const INBOUND_PATH = "/api/webhooks/infobip/sms";

function isLocalhostHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".local")
  );
}

/** True for public https origins Infobip accepts for MO HTTP forward. */
export function isPublicHttpsWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (!u.hostname) return false;
    if (isLocalhostHostname(u.hostname)) return false;
    return u.pathname.length > 1;
  } catch {
    return false;
  }
}

function originFromBase(base: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    const u = new URL(trimmed);
    return u.origin;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Webhook URL for Infobip MO forward / subscription notifyUrl.
 * Never returns localhost — Infobip portal shows "Not a valid URL" for that.
 */
export function resolveInfobipInboundWebhookUrl(): string {
  const explicit = process.env.INFOBIP_INBOUND_WEBHOOK_URL?.trim();
  if (explicit) {
    const normalized = explicit.replace(/\/$/, "");
    if (isPublicHttpsWebhookUrl(normalized)) return normalized;
    if (!normalized.includes(INBOUND_PATH)) {
      const withPath = `${originFromBase(normalized)}${INBOUND_PATH}`;
      if (isPublicHttpsWebhookUrl(withPath)) return withPath;
    }
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    const host = vercelHost.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    const url = `https://${host}${INBOUND_PATH}`;
    if (isPublicHttpsWebhookUrl(url)) return url;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) {
    const origin = originFromBase(base);
    if (!isLocalhostHostname(new URL(origin).hostname)) {
      const url = `${origin}${INBOUND_PATH}`;
      if (isPublicHttpsWebhookUrl(url)) return url;
    }
  }

  return `${GEOTRAVEL_PRODUCTION_APP_ORIGIN}${INBOUND_PATH}`;
}

export function infobipInboundWebhookUrlHint(): string {
  return resolveInfobipInboundWebhookUrl();
}
