/**
 * OAuth2 client_credentials for Partners API.
 * @see https://webhook.backoffice.tg4travel.com/index.html#/ — POST /oauth/token?grant_type=client_credentials
 */

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

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
  const now = Date.now();
  if (cache && cache.expiresAtMs > now) {
    return { ok: true, token: cache.token };
  }

  const clientId = process.env.TG4TRAVEL_CLIENT_ID?.trim();
  const clientSecret = process.env.TG4TRAVEL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { ok: false, error: "tg4_missing_client_credentials" };
  }

  const base = getTg4ApiBaseUrl();
  const url = `${base}/oauth/token?grant_type=client_credentials`;
  const scope = process.env.TG4TRAVEL_OAUTH_SCOPE?.trim();

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  if (scope) {
    body.set("scope", scope);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `tg4_token_network:${msg}` };
  }

  let json: TokenResponse;
  try {
    json = (await res.json()) as TokenResponse;
  } catch {
    return { ok: false, error: `tg4_token_invalid_json:${res.status}` };
  }

  if (!res.ok || !json.access_token) {
    const hint =
      json.error_description ?? json.error ?? (await res.text().catch(() => ""));
    return {
      ok: false,
      error: `tg4_token_http_${res.status}:${hint || "no_token"}`,
    };
  }

  const ttlSec =
    typeof json.expires_in === "number" && json.expires_in > 0
      ? json.expires_in
      : 3600;
  cache = {
    token: json.access_token,
    expiresAtMs: now + ttlSec * 1000 - SKEW_MS,
  };
  return { ok: true, token: json.access_token };
}

/** For tests */
export function clearTg4TokenCache() {
  cache = null;
}
