/**
 * TG4Travel Partners API auth.
 *
 * The vendor provides a single static Bearer token — no OAuth exchange needed.
 * Set TG4TRAVEL_BEARER_TOKEN in .env.local and use it directly on all calls.
 *
 * @see https://webhook.backoffice.tg4travel.com/index.html#/
 */

let cache: { token: string; expiresAtMs: number } | null = null;
const SKEW_MS = 60_000;

export function getTg4ApiBaseUrl(): string {
  const raw =
    process.env.TG4TRAVEL_API_BASE_URL?.trim() ||
    "https://webhook.backoffice.tg4travel.com/api";
  return raw.replace(/\/+$/, "");
}

export async function getTg4AccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  // Static bearer token — use directly, no exchange required.
  const staticToken = process.env.TG4TRAVEL_BEARER_TOKEN?.trim();
  if (staticToken) {
    return { ok: true, token: staticToken };
  }

  // Legacy: OAuth client_credentials fallback (access_key + secret_key).
  const now = Date.now();
  if (cache && cache.expiresAtMs > now) {
    return { ok: true, token: cache.token };
  }

  const accessKey = process.env.TG4TRAVEL_CLIENT_ID?.trim();
  const secretKey = process.env.TG4TRAVEL_CLIENT_SECRET?.trim() ?? "";
  if (!accessKey) {
    return {
      ok: false,
      error:
        "Set TG4TRAVEL_BEARER_TOKEN in .env.local (single static token provided by TG4Travel).",
    };
  }

  const base = getTg4ApiBaseUrl();
  const url = `${base}/oauth/token?grant_type=client_credentials`;
  const basicCreds = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("access_key", accessKey);
  if (secretKey) body.set("secret_key", secretKey);
  const scope = process.env.TG4TRAVEL_OAUTH_SCOPE?.trim();
  if (scope) body.set("scope", scope);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicCreds}`,
      },
      body: body.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `tg4_token_network:${msg}` };
  }

  type TokenResponse = {
    access_token?: string;
    expires_in?: number | string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  let json: TokenResponse;
  try {
    json = (await res.json()) as TokenResponse;
  } catch {
    return { ok: false, error: `tg4_token_invalid_json:${res.status}` };
  }

  if (!res.ok || !json.access_token) {
    const hint = json.error_description ?? json.error ?? "";
    return { ok: false, error: `tg4_token_http_${res.status}:${hint || "no_token"}` };
  }

  const rawTtl = json.expires_in;
  const ttlSec =
    typeof rawTtl === "number" && rawTtl > 0
      ? rawTtl
      : typeof rawTtl === "string" && Number(rawTtl) > 0
        ? Number(rawTtl)
        : 3600;

  cache = { token: json.access_token, expiresAtMs: now + ttlSec * 1000 - SKEW_MS };
  return { ok: true, token: json.access_token };
}

/** For tests */
export function clearTg4TokenCache() {
  cache = null;
}
