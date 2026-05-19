import { pullGeotravelBookingsDeltaWindow } from "@/lib/geotravel/bookings-api";
import {
  geotravelBookingsIncrementalEnabled,
  getGeotravelBookingsSyncCursor,
  initialGeotravelBookingsUpdatedFrom,
} from "@/lib/geotravel/bookings-sync-cursor";

function defaultDeltaStartIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export type GeotravelBookingsDeltaSyncResult =
  | {
      ok: true;
      skipped: true;
      reason: string;
    }
  | {
      ok: true;
      skipped: false;
      updatedFrom: string;
      rowsInWindow: number;
      cursorAdvancedTo: string | null;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Pull Geotravel bookings changed since the stored watermark, update cursor + admin highlights.
 * Does not send WhatsApp/SMS or touch orchestration — API fetch + Supabase metadata only.
 */
export async function runGeotravelBookingsDeltaSync(): Promise<GeotravelBookingsDeltaSyncResult> {
  if (!geotravelBookingsIncrementalEnabled()) {
    return { ok: true, skipped: true, reason: "incremental_disabled" };
  }

  if (!process.env.GEOTRAVEL_API_KEY?.trim()) {
    return { ok: false, error: "GEOTRAVEL_API_KEY not set" };
  }

  const stored = await getGeotravelBookingsSyncCursor();
  const updatedFrom =
    stored ?? initialGeotravelBookingsUpdatedFrom() ?? defaultDeltaStartIso();

  const pull = await pullGeotravelBookingsDeltaWindow({}, updatedFrom);
  if (!pull.ok) {
    return { ok: false, error: pull.error };
  }

  return {
    ok: true,
    skipped: false,
    updatedFrom,
    rowsInWindow: pull.rows.length,
    cursorAdvancedTo: pull.cursorAdvancedTo,
  };
}
