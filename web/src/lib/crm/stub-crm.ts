import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reservations } from "@/db/schema";
import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";
import type { CrmClient, CrmWriteResult } from "./port";

/**
 * Stub CRM: validates reservation exists; local timestamps are updated in sync-with-retry.
 */
export function createStubCrm(): CrmClient {
  return {
    async writeEnrichment(payload: CrmEnrichmentWrite): Promise<CrmWriteResult> {
      try {
        const db = getDb();
        const [match] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.externalSource, payload.external_source),
              eq(reservations.externalBookingId, payload.external_booking_id),
            ),
          )
          .limit(1);
        if (!match) {
          return { ok: false, error: "reservation_not_found_for_stub" };
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },

    async writeConfirmation(
      payload: CrmConfirmationWrite,
    ): Promise<CrmWriteResult> {
      try {
        const db = getDb();
        const [match] = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.externalSource, payload.external_source),
              eq(reservations.externalBookingId, payload.external_booking_id),
            ),
          )
          .limit(1);
        if (!match) {
          return { ok: false, error: "reservation_not_found_for_stub" };
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  };
}
