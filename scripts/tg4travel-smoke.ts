/**
 * Read-only smoke test for TG4Travel Partners API.
 * Uses the static Bearer token — calls POST /v2/bookings_list.
 *
 * Run: npm run tg4travel:smoke
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const base =
    process.env.TG4TRAVEL_API_BASE_URL?.trim() ||
    "https://webhook.backoffice.tg4travel.com/api";
  const token = process.env.TG4TRAVEL_BEARER_TOKEN?.trim();

  if (!token) {
    console.error(
      "✗ TG4TRAVEL_BEARER_TOKEN is not set in .env.local\n" +
        "  Add the static token provided by TG4Travel.\n",
    );
    process.exit(1);
  }

  console.log("TG4Travel smoke test\n");
  console.log("Base URL:", base);
  console.log("Token:   ", token.slice(0, 4) + "…" + token.slice(-4));
  console.log();

  // POST /v2/bookings_list — paginated list, first 5 entries
  const url = `${base}/v2/bookings_list`;
  console.log("POST", url);

  const body = new URLSearchParams({ start: "0", length: "5" });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  console.log("HTTP", res.status, res.statusText);

  type ApiResponse = {
    status?: boolean;
    total_count?: number;
    filtered_count?: number;
    data?: unknown[];
    message?: string;
  };

  let parsed: ApiResponse | null = null;
  try {
    parsed = JSON.parse(text) as ApiResponse;
  } catch {
    console.error("(non-JSON response):", text.slice(0, 500));
    process.exit(1);
  }

  const msg = (parsed.message ?? "").toLowerCase();
  const isAuthError =
    /invalid|unauthori|not matched|forbidden|denied/.test(msg) ||
    res.status === 401 ||
    res.status === 403 ||
    parsed.status === false;

  if (isAuthError) {
    console.error("✗ Auth error:", parsed.message ?? res.status);
    process.exit(1);
  }

  console.log();
  console.log(`✓ Token accepted`);
  console.log(`  total_count:    ${parsed.total_count ?? "?"}`);
  console.log(`  filtered_count: ${parsed.filtered_count ?? "?"}`);
  console.log(`  returned:       ${parsed.data?.length ?? 0} bookings`);

  if (parsed.data && parsed.data.length > 0) {
    const first = parsed.data[0] as Record<string, unknown>;
    console.log("\nFirst booking fields:");
    for (const [k, v] of Object.entries(first).slice(0, 20)) {
      const s = String(v);
      console.log(`  ${k}: ${s.length > 80 ? s.slice(0, 80) + "…" : s}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
