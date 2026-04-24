/**
 * Read-only smoke test: GET /bookings (per WhiteLabel PDF — system token).
 * Does not POST, PUT, DELETE, or mutate any data.
 *
 * Run: npx tsx scripts/whitelabel-smoke.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function summarizeJson(text: string, maxLen = 800): string {
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      const preview: Record<string, string> = {};
      for (const k of keys) {
        const val = o[k];
        if (Array.isArray(val)) {
          preview[k] = `array(${val.length} items)`;
        } else if (val && typeof val === "object") {
          preview[k] = "object";
        } else {
          preview[k] =
            typeof val === "string" && val.length > 80
              ? `${val.slice(0, 80)}…`
              : String(val);
        }
      }
      return JSON.stringify(preview, null, 2);
    }
    const s = JSON.stringify(v);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  }
}

async function tryGet(url: string, authHeader: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  });
}

async function main() {
  const base =
    process.env.WHITELABEL_API_BASE_URL?.trim() ||
    "https://wl-api.activglobal.net";
  const token = process.env.WHITELABEL_ACCESS_TOKEN?.trim();

  if (!token) {
    console.error(
      "Missing WHITELABEL_ACCESS_TOKEN in .env.local (and no inline default).",
    );
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, "")}/bookings`;
  console.log("WhiteLabel read-only smoke test\n");
  console.log("GET", url);
  console.log("(no body, no mutations)\n");

  let res = await tryGet(url, token);
  if (res.status === 200) {
    const peek = await res.clone().text();
    const msg = (() => {
      try { return (JSON.parse(peek) as { message?: string }).message ?? ""; } catch { return ""; }
    })();
    if (/not matched|invalid|unauthori|expired|denied|forbidden/.test(msg.toLowerCase())) {
      console.log("Raw token returned 'not matched', retrying with Bearer scheme…\n");
      res = await tryGet(url, `Bearer ${token}`);
    }
  } else if (res.status === 401 || res.status === 403) {
    console.log(`Raw token returned ${res.status}, retrying with Bearer scheme…\n`);
    res = await tryGet(url, `Bearer ${token}`);
  }

  const text = await res.text();
  console.log("HTTP", res.status, res.statusText);
  console.log("Content-Type:", res.headers.get("content-type") ?? "(none)");
  console.log("\n--- Response (summarized, no full payloads) ---\n");
  console.log(summarizeJson(text));
  console.log();

  let logicalError = false;
  try {
    const j = JSON.parse(text) as { message?: string };
    const m = (j.message ?? "").toLowerCase();
    if (
      /not matched|invalid|unauthori|expired|denied|forbidden/.test(m)
    ) {
      logicalError = true;
    }
  } catch {
    /* ignore */
  }

  if (!res.ok || logicalError) {
    console.log(
      "✗ API did not accept the request (check status and message above).",
    );
    console.log(
      "  Confirm WHITELABEL_ACCESS_TOKEN in .env.local matches the system token for GET /bookings.",
    );
    console.log(
      "  Swagger: https://wl-api.activglobal.net/swagger/",
    );
    process.exit(1);
  }

  console.log("✓ GET /bookings returned success — token matches.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
