import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cases, crmSyncAttempts, reservations } from "@/db/schema";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";
import { createCrmClient } from "./create-crm-client";

async function touchLocalReservationCrmTimestamp(
  reservationId: string,
  kind: "enrichment" | "confirmation",
) {
  const db = getDb();
  const now = new Date();
  await db
    .update(reservations)
    .set(
      kind === "enrichment"
        ? {
            lastSyncedAt: now,
            crmEnrichmentSyncedAt: now,
          }
        : {
            lastSyncedAt: now,
            crmConfirmationSyncedAt: now,
          },
    )
    .where(eq(reservations.id, reservationId));
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
  const db = getDb();
  const result = await crm.writeEnrichment(input.payload);
  await db.insert(crmSyncAttempts).values({
    caseId: input.caseId,
    kind: "enrichment",
    payload: input.payload as unknown as Record<string, unknown>,
    status: result.ok ? "succeeded" : "failed",
    errorMessage: result.ok ? null : result.error,
  });
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
  const db = getDb();
  const result = await crm.writeConfirmation(input.payload);
  await db.insert(crmSyncAttempts).values({
    caseId: input.caseId,
    kind: "confirmation",
    payload: input.payload as unknown as Record<string, unknown>,
    status: result.ok ? "succeeded" : "failed",
    errorMessage: result.ok ? null : result.error,
  });
  if (result.ok) {
    await touchLocalReservationCrmTimestamp(input.reservationId, "confirmation");
    await writeBehaviouralEvent({
      eventType: "crm_write_succeeded",
      caseId: input.caseId,
      reservationId: input.reservationId,
    });
    await db
      .update(cases)
      .set({
        confirmationStatus: input.payload.d1_confirmed ? "confirmed" : "not_confirmed",
        updatedAt: new Date(),
      })
      .where(eq(cases.id, input.caseId));
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
