import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";
import { serviceSupabase } from "@/lib/supabase/service-role";
import type { CrmClient, CrmWriteResult } from "./port";

/**
 * Stub CRM: validates reservation exists; local timestamps are updated in sync-with-retry.
 */
export function createStubCrm(): CrmClient {
  return {
    async writeEnrichment(payload: CrmEnrichmentWrite): Promise<CrmWriteResult> {
      try {
        const sb = serviceSupabase();
        const { data, error } = await sb
          .from("reservations")
          .select("id")
          .eq("external_source", payload.external_source)
          .eq("external_booking_id", payload.external_booking_id)
          .limit(1)
          .maybeSingle();
        if (error) {
          return { ok: false, error: error.message };
        }
        if (!data) {
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
        const sb = serviceSupabase();
        const { data, error } = await sb
          .from("reservations")
          .select("id")
          .eq("external_source", payload.external_source)
          .eq("external_booking_id", payload.external_booking_id)
          .limit(1)
          .maybeSingle();
        if (error) {
          return { ok: false, error: error.message };
        }
        if (!data) {
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
