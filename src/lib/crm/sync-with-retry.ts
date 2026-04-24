import { assertNoError } from "@/db/supabase-helpers";
import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { serviceSupabase } from "@/lib/supabase/service-role";
import { createCrmClient } from "./create-crm-client";

async function touchLocalReservationCrmTimestamp(
  reservationId: string,
  kind: "enrichment" | "confirmation",
) {
  const sb = serviceSupabase();
  const now = new Date().toISOString();
  const patch =
    kind === "enrichment"
      ? {
          last_synced_at: now,
          crm_enrichment_synced_at: now,
        }
      : {
          last_synced_at: now,
          crm_confirmation_synced_at: now,
        };
  assertNoError(
    "touch reservation crm timestamp",
    await sb.from("reservations").update(patch).eq("id", reservationId),
  );
}

export async function syncEnrichmentToCrm(input: {
  caseId: string;
  reservationId: string;
  payload: CrmEnrichmentWrite;
}) {
  const crm = createCrmClient();
  await writeBehaviouralEvent({
    eventType: "crm_write_attempted",
    caseId: input.caseId,
    reservationId: input.reservationId,
    payload: { kind: "enrichment", crm_mode: process.env.CRM_MODE ?? "stub" },
  });
  const sb = serviceSupabase();
  const result = await crm.writeEnrichment(input.payload);
  assertNoError(
    "crm_sync_attempts insert (enrichment)",
    await sb.from("crm_sync_attempts").insert({
      case_id: input.caseId,
      kind: "enrichment",
      payload: input.payload as unknown as Record<string, unknown>,
      status: result.ok ? "succeeded" : "failed",
      error_message: result.ok ? null : result.error,
    }),
  );
  if (result.ok) {
    await touchLocalReservationCrmTimestamp(input.reservationId, "enrichment");
    await writeBehaviouralEvent({
      eventType: "crm_write_succeeded",
      caseId: input.caseId,
      reservationId: input.reservationId,
    });
  } else {
    await writeBehaviouralEvent({
      eventType: "crm_write_failed",
      caseId: input.caseId,
      reservationId: input.reservationId,
      payload: { error: result.error },
    });
  }
  return result;
}

export async function syncConfirmationToCrm(input: {
  caseId: string;
  reservationId: string;
  payload: CrmConfirmationWrite;
}) {
  const crm = createCrmClient();
  await writeBehaviouralEvent({
    eventType: "crm_write_attempted",
    caseId: input.caseId,
    reservationId: input.reservationId,
    payload: { kind: "confirmation", crm_mode: process.env.CRM_MODE ?? "stub" },
  });
  const sb = serviceSupabase();
  const result = await crm.writeConfirmation(input.payload);
  assertNoError(
    "crm_sync_attempts insert (confirmation)",
    await sb.from("crm_sync_attempts").insert({
      case_id: input.caseId,
      kind: "confirmation",
      payload: input.payload as unknown as Record<string, unknown>,
      status: result.ok ? "succeeded" : "failed",
      error_message: result.ok ? null : result.error,
    }),
  );
  if (result.ok) {
    await touchLocalReservationCrmTimestamp(input.reservationId, "confirmation");
    await writeBehaviouralEvent({
      eventType: "crm_write_succeeded",
      caseId: input.caseId,
      reservationId: input.reservationId,
    });
    assertNoError(
      "cases confirmation update",
      await sb
        .from("cases")
        .update({
          confirmation_status: input.payload.d1_confirmed
            ? "confirmed"
            : "not_confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.caseId),
    );
  } else {
    await writeBehaviouralEvent({
      eventType: "crm_write_failed",
      caseId: input.caseId,
      reservationId: input.reservationId,
      payload: { error: result.error },
    });
  }
  return result;
}
