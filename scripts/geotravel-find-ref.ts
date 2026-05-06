/**
 * Scan Geotravel Data API pages for a substring in booking_reference or numeric id.
 * Run: npx tsx scripts/geotravel-find-ref.ts 900017
 * Optional second arg: max rows to scan (default 50000).
 *
 * The API may return HTTP 429 if you run this too often; wait and retry, or use
 * /admin/bookings Ref search (same scan, single user action).
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const API_BASE =
  "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api";

async function main() {
  const needle = (process.argv[2] ?? "").trim();
  const maxScan = Math.max(
    250,
    Math.min(500_000, Number(process.argv[3] ?? 50_000) || 50_000),
  );
  if (!needle) {
    console.error("Usage: npx tsx scripts/geotravel-find-ref.ts <substring> [maxScanRows]");
    process.exit(1);
  }
  const key = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!key) {
    console.error("Set GEOTRAVEL_API_KEY in .env.local");
    process.exit(1);
  }

  const found: {
    id: number;
    booking_reference: string | null;
    status: string | null;
    plateform: string | null;
    outcome: string | null;
  }[] = [];

  const limit = 250;
  let offset = 0;
  let apiTotal = 0;
  const lower = needle.toLowerCase();

  while (offset < maxScan) {
    const url = `${API_BASE}?${new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await res.json()) as {
      data?: {
        id: number;
        booking_reference?: string | null;
        status?: string | null;
        plateform?: string | null;
        outcome?: string | null;
      }[];
      pagination?: { total: number };
    };
    if (!res.ok) {
      console.error("HTTP", res.status, JSON.stringify(json).slice(0, 400));
      process.exit(2);
    }
    apiTotal = json.pagination?.total ?? 0;
    const rows = json.data ?? [];
    for (const r of rows) {
      const ref = String(r.booking_reference ?? "");
      if (
        ref.toLowerCase().includes(lower) ||
        String(r.id) === needle ||
        ref.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
      ) {
        found.push({
          id: r.id,
          booking_reference: r.booking_reference ?? null,
          status: r.status ?? null,
          plateform: r.plateform ?? null,
          outcome: r.outcome ?? null,
        });
      }
    }
    if (rows.length < limit) break;
    offset += limit;
    if (offset >= apiTotal) break;
  }

  const truncated = offset < apiTotal;
  console.log("API total:", apiTotal);
  console.log("Scanned rows:", Math.min(offset, apiTotal), truncated ? "(stopped early)" : "");
  console.log("Matches:", found.length);
  console.log(JSON.stringify(found, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
