import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  behaviouralEvents,
  cases,
  crmSyncAttempts,
  messages,
  reservations,
} from "@/db/schema";

export async function listCasesWithReservation() {
  const db = getDb();
  return db
    .select({
      case: cases,
      reservation: reservations,
    })
    .from(cases)
    .innerJoin(reservations, eq(cases.reservationId, reservations.id))
    .orderBy(desc(cases.updatedAt))
    .limit(200);
}

export async function getCaseDetail(caseId: string) {
  const db = getDb();
  const row = await db
    .select({
      case: cases,
      reservation: reservations,
    })
    .from(cases)
    .innerJoin(reservations, eq(cases.reservationId, reservations.id))
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row[0]) return null;
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.caseId, caseId))
    .orderBy(desc(messages.createdAt))
    .limit(100);
  const events = await db
    .select()
    .from(behaviouralEvents)
    .where(eq(behaviouralEvents.caseId, caseId))
    .orderBy(desc(behaviouralEvents.createdAt))
    .limit(200);
  const crm = await db
    .select()
    .from(crmSyncAttempts)
    .where(eq(crmSyncAttempts.caseId, caseId))
    .orderBy(desc(crmSyncAttempts.createdAt))
    .limit(50);
  return { ...row[0], messages: msgs, events, crmSync: crm };
}

export async function getQualityStats() {
  const db = getDb();
  const [totalCases] = await db.select({ value: count() }).from(cases);
  const [enrichmentComplete] = await db
    .select({ value: count() })
    .from(cases)
    .where(eq(cases.enrichmentStatus, "complete"));
  const [d1Confirmed] = await db
    .select({ value: count() })
    .from(cases)
    .where(eq(cases.confirmationStatus, "confirmed"));
  const [human] = await db
    .select({ value: count() })
    .from(cases)
    .where(eq(cases.humanIntervention, true));
  const [smsFallback] = await db
    .select({ value: count() })
    .from(behaviouralEvents)
    .where(eq(behaviouralEvents.eventType, "fallback_sms_triggered"));
  const [lowConf] = await db
    .select({ value: count() })
    .from(behaviouralEvents)
    .where(eq(behaviouralEvents.eventType, "extraction_low_confidence"));
  const byChannel = await db
    .select({
      channel: messages.channel,
      n: count(),
    })
    .from(messages)
    .groupBy(messages.channel);
  return {
    totalCases: totalCases?.value ?? 0,
    enrichmentComplete: enrichmentComplete?.value ?? 0,
    d1Confirmed: d1Confirmed?.value ?? 0,
    humanIntervention: human?.value ?? 0,
    smsFallbackEvents: smsFallback?.value ?? 0,
    lowConfidenceEvents: lowConf?.value ?? 0,
    messagesByChannel: byChannel,
  };
}
