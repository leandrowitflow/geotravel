import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";
import type { CrmClient, CrmWriteResult } from "../port";
import { getTg4AccessToken, getTg4ApiBaseUrl } from "./oauth-token";
import {
  buildSaveBookingBodyFromConfirmation,
  buildSaveBookingBodyFromEnrichment,
} from "./map-save-booking-body";

/**
 * TG4 Travel Partners backoffice API (bookings).
 * @see https://webhook.backoffice.tg4travel.com/index.html#/
 */
export function createTg4TravelCrm(): CrmClient {
  return {
    async writeEnrichment(payload: CrmEnrichmentWrite): Promise<CrmWriteResult> {
      return saveBooking(buildSaveBookingBodyFromEnrichment(payload));
    },

    async writeConfirmation(
      payload: CrmConfirmationWrite,
    ): Promise<CrmWriteResult> {
      return saveBooking(buildSaveBookingBodyFromConfirmation(payload));
    },
  };
}

async function saveBooking(body: Record<string, unknown>): Promise<CrmWriteResult> {
  const token = await getTg4AccessToken();
  if (!token.ok) {
    return { ok: false, error: token.error };
  }

  const base = getTg4ApiBaseUrl();
  const method = (
    process.env.TG4TRAVEL_SAVE_BOOKING_METHOD?.trim() || "PUT"
  ).toUpperCase();
  if (method !== "POST" && method !== "PUT") {
    return { ok: false, error: "tg4_invalid_SAVE_BOOKING_METHOD" };
  }

  const url = `${base}/v2/saveBooking`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `tg4_save_network:${msg}` };
  }

  if (res.ok) {
    return { ok: true };
  }

  const errText = await res.text().catch(() => "");
  return {
    ok: false,
    error: `tg4_save_${res.status}:${errText.slice(0, 500)}`,
  };
}
