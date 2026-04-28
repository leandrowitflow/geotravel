/**
 * Audits the 30 booking fields from the live Geotravel Data API (sample of rows).
 * Run: npx tsx scripts/geotravel-field-audit.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const API_BASE =
  "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api";

const FIELDS = [
  "id",
  "outcome",
  "plateform",
  "pickup_date_time",
  "pickup_city",
  "pickup_country",
  "pickup_location_type",
  "pickup_latitude",
  "pickup_longitude",
  "dropoff_city",
  "dropoff_country",
  "dropoff_location_type",
  "dropoff_latitude",
  "dropoff_longitude",
  "nearest_airport",
  "vehicle_type",
  "passenger_count",
  "distance_km",
  "invoice_country",
  "booking_reference",
  "passenger_phone",
  "loyalty_name",
  "direction",
  "is_return",
  "multidays",
  "trip_type",
  "pickup_dow",
  "avg_amount_km",
  "book_lead_time",
  "cancel_lead_time",
] as const;

async function main() {
  const key = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!key) {
    console.error("Set GEOTRAVEL_API_KEY in .env.local");
    process.exit(1);
  }

  const limit = 80;
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 400; offset += limit) {
    const url = `${API_BASE}?${new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(url, {
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = (await res.json()) as { data?: Record<string, unknown>[] };
    if (!res.ok) {
      console.error("HTTP", res.status, JSON.stringify(j).slice(0, 500));
      process.exit(2);
    }
    const chunk = j.data ?? [];
    rows.push(...chunk);
    if (chunk.length < limit) break;
  }

  if (rows.length === 0) {
    console.log("No rows returned.");
    process.exit(0);
  }

  const n = rows.length;
  const stats: Record<
    string,
    { keyPresent: number; nonNull: number; nonEmptyStr: number }
  > = {};
  for (const f of FIELDS) {
    stats[f] = { keyPresent: 0, nonNull: 0, nonEmptyStr: 0 };
  }

  for (const r of rows) {
    for (const f of FIELDS) {
      if (Object.prototype.hasOwnProperty.call(r, f)) stats[f].keyPresent++;
      const v = r[f];
      if (v !== null && v !== undefined) stats[f].nonNull++;
      if (typeof v === "string" && v.trim() !== "") stats[f].nonEmptyStr++;
    }
  }

  console.log(`Rows sampled: ${n}`);
  console.log(`Keys on first row: ${Object.keys(rows[0] ?? {}).length}`);
  console.log("");

  const problems: string[] = [];
  for (const f of FIELDS) {
    const s = stats[f];
    const missingKey = s.keyPresent === 0;
    const alwaysNull = s.keyPresent === n && s.nonNull === 0;
    const neverPopulated =
      s.keyPresent === n &&
      s.nonNull === n &&
      s.nonEmptyStr === 0 &&
      typeof rows[0][f] === "string";

    let status = "OK (tem valores em parte das linhas)";
    if (missingKey) {
      status = "NÃO EXISTE (chave ausente em todas as linhas)";
      problems.push(f);
    } else if (alwaysNull) {
      status = "EXISTE mas está sempre null nesta amostra";
      problems.push(f);
    } else if (neverPopulated) {
      status = "EXISTE mas strings sempre vazias nesta amostra";
      problems.push(f);
    } else if (s.nonNull < n * 0.05) {
      status = `QUASE VAZIO (~${Math.round((s.nonNull / n) * 100)}% non-null)`;
    }

    console.log(`${f.padEnd(22)} ${status}`);
  }

  console.log("");
  console.log(
    "Campos com problema (ausente / sempre null / sempre string vazia):",
    problems.length ? problems.join(", ") : "nenhum nestes critérios",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
