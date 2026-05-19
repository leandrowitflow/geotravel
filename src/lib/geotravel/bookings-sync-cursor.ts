import { assertNoError } from "@/db/supabase-helpers";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { serviceSupabase } from "@/lib/supabase/service-role";

const CURSOR_KEY = "geotravel_bookings_api_updated_from";
const HIGHLIGHTS_KEY = "geotravel_bookings_delta_highlights";

export type GeotravelDeltaHighlights = {
  bookingIds: number[];
  /** `updated_from` used for the pull that produced this highlight set. */
  since: string;
  syncedAt: string;
};

export function geotravelBookingsIncrementalEnabled(): boolean {
  const full = process.env.GEOTRAVEL_BOOKINGS_FULL_FETCH?.trim().toLowerCase();
  if (full === "1" || full === "true" || full === "yes") return false;
  const off = process.env.GEOTRAVEL_BOOKINGS_INCREMENTAL?.trim().toLowerCase();
  if (off === "0" || off === "false" || off === "no") return false;
  return true;
}

/** ISO-8601 watermark for the next `updated_from` request (exclusive window end is `updated_to` if set). */
export async function getGeotravelBookingsSyncCursor(): Promise<string | null> {
  const sb = serviceSupabase();
  const { data, error } = await sb
    .from("idempotency_keys")
    .select("result")
    .eq("key", CURSOR_KEY)
    .maybeSingle();
  if (error) throw new Error(`geotravel sync cursor read: ${error.message}`);
  const raw = data?.result?.trim();
  return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
}

export async function setGeotravelBookingsSyncCursor(iso: string): Promise<void> {
  if (Number.isNaN(Date.parse(iso))) {
    throw new Error(`invalid cursor ISO: ${iso}`);
  }
  const sb = serviceSupabase();
  assertNoError(
    "geotravel sync cursor upsert",
    await sb.from("idempotency_keys").upsert(
      { key: CURSOR_KEY, result: iso },
      { onConflict: "key" },
    ),
  );
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** Latest `updated_at` in a batch (API now returns this on every row). */
export function maxUpdatedAtFromBookings(
  rows: GeotravelBooking[],
): string | null {
  let max: string | null = null;
  for (const row of rows) {
    const u = row.updated_at?.trim();
    if (!u || Number.isNaN(Date.parse(u))) continue;
    max = max == null ? u : maxIso(max, u);
  }
  return max;
}

/**
 * Move the stored watermark forward after a successful delta page (monotonic).
 * Call when the user has reached the last page of the current delta window.
 */
export async function advanceGeotravelBookingsSyncCursor(
  rows: GeotravelBooking[],
): Promise<string | null> {
  const batchMax = maxUpdatedAtFromBookings(rows);
  if (!batchMax) return null;
  const prev = await getGeotravelBookingsSyncCursor();
  const next = prev == null ? batchMax : maxIso(prev, batchMax);
  await setGeotravelBookingsSyncCursor(next);
  return next;
}

/** Optional bootstrap when no cursor exists yet (ISO-8601). */
export function initialGeotravelBookingsUpdatedFrom(): string | undefined {
  const raw = process.env.GEOTRAVEL_BOOKINGS_INITIAL_UPDATED_FROM?.trim();
  if (raw && !Number.isNaN(Date.parse(raw))) return raw;
  return undefined;
}

export async function getGeotravelBookingsDeltaHighlights(): Promise<GeotravelDeltaHighlights | null> {
  const sb = serviceSupabase();
  const { data, error } = await sb
    .from("idempotency_keys")
    .select("result")
    .eq("key", HIGHLIGHTS_KEY)
    .maybeSingle();
  if (error) throw new Error(`geotravel delta highlights read: ${error.message}`);
  if (!data?.result) return null;
  try {
    const parsed = JSON.parse(data.result) as GeotravelDeltaHighlights;
    if (!Array.isArray(parsed.bookingIds) || !parsed.since || !parsed.syncedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Remember which bookings were new/changed in the last delta pull (for row highlighting). */
export async function saveGeotravelBookingsDeltaHighlights(
  rows: GeotravelBooking[],
  since: string,
): Promise<GeotravelDeltaHighlights> {
  const payload: GeotravelDeltaHighlights = {
    bookingIds: [...new Set(rows.map((r) => r.id))],
    since,
    syncedAt: new Date().toISOString(),
  };
  const sb = serviceSupabase();
  assertNoError(
    "geotravel delta highlights upsert",
    await sb.from("idempotency_keys").upsert(
      { key: HIGHLIGHTS_KEY, result: JSON.stringify(payload) },
      { onConflict: "key" },
    ),
  );
  return payload;
}

/** True when this row was in the last delta sync or has updated_at on/after that window. */
export function isBookingDeltaHighlight(
  booking: GeotravelBooking,
  highlights: GeotravelDeltaHighlights | null,
): boolean {
  if (!highlights) return false;
  if (highlights.bookingIds.includes(booking.id)) return true;
  const u = booking.updated_at?.trim();
  if (!u || Number.isNaN(Date.parse(u)) || Number.isNaN(Date.parse(highlights.since))) {
    return false;
  }
  return new Date(u).getTime() >= new Date(highlights.since).getTime();
}
