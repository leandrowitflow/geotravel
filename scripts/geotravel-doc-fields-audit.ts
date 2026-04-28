/**
 * Compares LIVE Geotravel bookings API rows against the documented field list
 * (from product docs — not only keys that happened to appear in one sample).
 *
 * Run: npx tsx scripts/geotravel-doc-fields-audit.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const API_BASE =
  "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api";

/** 30 fields as in operator documentation (names + expected role). */
const DOC_FIELDS = [
  "id",
  "status",
  "outcome",
  "plateform",
  "booked_date",
  "pickup_date_time",
  "pickup_city",
  "pickup_country",
  "pickup_address",
  "pickup_location_type",
  "dropoff_city",
  "dropoff_country",
  "dropoff_address",
  "dropoff_location_type",
  "nearest_airport",
  "vehicle_type",
  "passenger_count",
  "distance_km",
  "amount",
  "invoice_country",
  "booking_reference",
  "passenger_phone",
  "passenger_name",
  "loyalty_name",
  "direction",
  "trip_type",
  "is_return",
  "multidays",
  "book_lead_time",
  "pickup_dow",
] as const;

function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

async function main() {
  const key = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!key) {
    console.error("Set GEOTRAVEL_API_KEY in .env.local");
    process.exit(1);
  }

  const limit = 100;
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 500; offset += limit) {
    const url = `${API_BASE}?${new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(url, {
      headers: { "x-api-key": key, Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = (await res.json()) as { data?: Record<string, unknown>[] };
    if (!res.ok) {
      console.error("HTTP", res.status, JSON.stringify(j).slice(0, 400));
      process.exit(2);
    }
    const chunk = j.data ?? [];
    rows.push(...chunk);
    if (chunk.length < limit) break;
  }

  const n = rows.length;
  if (n === 0) {
    console.log("Sem linhas.");
    process.exit(0);
  }

  const extraKeys = new Set<string>();
  for (const k of Object.keys(rows[0])) {
    if (!DOC_FIELDS.includes(k as (typeof DOC_FIELDS)[number])) extraKeys.add(k);
  }

  type Row = { field: string; verdict: string; keyPct: number; valuePct: number };
  const report: Row[] = [];

  for (const f of DOC_FIELDS) {
    let keyN = 0;
    let valN = 0;
    for (const r of rows) {
      if (Object.prototype.hasOwnProperty.call(r, f)) keyN++;
      if (Object.prototype.hasOwnProperty.call(r, f) && isMeaningful(r[f])) valN++;
    }
    const keyPct = Math.round((keyN / n) * 100);
    const valuePct = Math.round((valN / n) * 100);

    let verdict: string;
    if (keyN === 0) {
      verdict = "NAO EXISTE na API (chave ausente)";
    } else if (valN === 0) {
      verdict = "EXISTE mas sem dados (sempre null/vazio nesta amostra)";
    } else if (valuePct < 5) {
      verdict = `EXISTE mas quase vazio (~${valuePct}% com valor)`;
    } else {
      verdict = "OK (com dados em parte relevante das linhas)";
    }
    report.push({ field: f, verdict, keyPct, valuePct });
  }

  console.log(`Amostra: ${n} linhas.\n`);
  console.log("Campos da documentação vs API:\n");
  for (const r of report) {
    console.log(
      `${r.field.padEnd(22)} ${r.verdict} (chave ${r.keyPct}% · com valor ${r.valuePct}%)`,
    );
  }

  const missing = report.filter((r) => r.keyPct === 0).map((r) => r.field);
  const empty = report.filter((r) => r.keyPct > 0 && r.valuePct === 0).map((r) => r.field);
  const rare = report.filter((r) => r.valuePct > 0 && r.valuePct < 5).map((r) => r.field);

  console.log("\n--- Resumo ---");
  console.log("Ausentes na resposta:", missing.length ? missing.join(", ") : "nenhum");
  console.log(
    "Presentes mas sem valor útil nesta amostra:",
    empty.length ? empty.join(", ") : "nenhum",
  );
  console.log("Com valor em <5% das linhas:", rare.length ? rare.join(", ") : "nenhum");
  console.log(
    "\nChaves extra na API (na 1ª linha, não estão na lista de 30 da doc):",
    [...extraKeys].sort().join(", ") || "nenhuma",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
