/**
 * Prints distinct `status` and `outcome` values seen in Geotravel Data API booking rows.
 * Docs: https://geotraveldata.com/api-docs (field enums may not be listed there).
 *
 * Run: npx tsx scripts/geotravel-survey-status.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const API_BASE =
  "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api";

async function main() {
  const key = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!key) {
    console.error("Set GEOTRAVEL_API_KEY in .env.local");
    process.exit(1);
  }

  const statusSet = new Set<string>();
  const outcomeSet = new Set<string>();
  const limit = 200;
  const maxPages = 20;
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const url = `${API_BASE}?${new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);

    const json = (await res.json()) as {
      data?: { status?: string | null; outcome?: string | null }[];
    };
    if (!res.ok) {
      console.error("HTTP", res.status, JSON.stringify(json).slice(0, 400));
      process.exit(2);
    }

    const rows = json.data ?? [];
    for (const r of rows) {
      if (r.status != null && String(r.status).trim() !== "") {
        statusSet.add(String(r.status).trim());
      }
      if (r.outcome != null && String(r.outcome).trim() !== "") {
        outcomeSet.add(String(r.outcome).trim());
      }
    }

    if (rows.length < limit) break;
    offset += limit;
  }

  console.log("Distinct `status` values (" + statusSet.size + "):");
  console.log([...statusSet].sort().join("\n") || "(none or all null)");
  console.log("");
  console.log("Distinct `outcome` values (" + outcomeSet.size + "):");
  console.log([...outcomeSet].sort().join("\n") || "(none or all null)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
