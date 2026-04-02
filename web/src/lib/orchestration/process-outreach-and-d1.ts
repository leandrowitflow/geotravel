import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cases, contacts, messages, reservations } from "@/db/schema";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import { assertTransition, type OrchestrationState } from "./state-machine";
import {
  defaultRetryDelayMinutes,
  isQuietHourNow,
  maxOutboundAttempts,
} from "@/lib/scheduling/quiet-hours";

function normalizeToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export async function processOutreachQueue(): Promise<{ processed: number }> {
  const db = getDb();
  if (isQuietHourNow()) {
    return { processed: 0 };
  }
  const pending = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.orchestrationState, "awaiting_outreach"),
        eq(cases.caseStatus, "active"),
        or(
          lte(cases.nextRetryAt, new Date()),
          isNull(cases.nextRetryAt),
        ),
      ),
    )
    .limit(25);

  let processed = 0;
  for (const c of pending) {
    if (c.attemptCount >= c.maxAttempts) {
      await db
        .update(cases)
        .set({
          orchestrationState: "needs_human",
          exceptionFlag: true,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, c.id));
      continue;
    }
    const resv = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, c.reservationId))
      .limit(1);
    const r = resv[0];
    if (!r) continue;
    const cont = await db
      .select()
      .from(contacts)
      .where(eq(contacts.reservationId, r.id))
      .orderBy(desc(contacts.createdAt))
      .limit(1);
    const contact = cont[0];
    const to = normalizeToE164(contact?.phone ?? r.sourcePhone);
    if (!to) {
      await db
        .update(cases)
        .set({
          orchestrationState: "needs_human",
          exceptionFlag: true,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, c.id));
      continue;
    }
    const name = r.customerName ?? "there";
    const body = `Hi ${name}, this is Geotravel about your upcoming transfer (booking ${r.externalBookingId}). Is this the best number to reach you? Reply YES to confirm.`;
    const send = await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    if (send.ok) {
      await db.insert(messages).values({
        caseId: c.id,
        direction: "outbound",
        channel: send.channel,
        body,
        providerMessageId: send.providerMessageId,
        status: "sent",
      });
    }
    assertTransition(
      c.orchestrationState as OrchestrationState,
      "identity_confirm",
    );
    await db
      .update(cases)
      .set({
        orchestrationState: "identity_confirm",
        attemptCount: c.attemptCount + 1,
        nextRetryAt: new Date(
          Date.now() + defaultRetryDelayMinutes() * 60 * 1000,
        ),
        updatedAt: new Date(),
      })
      .where(eq(cases.id, c.id));
    processed += 1;
  }
  return { processed };
}

export async function processD1Confirmations(): Promise<{ processed: number }> {
  const db = getDb();
  if (isQuietHourNow()) {
    return { processed: 0 };
  }
  const now = new Date();
  const due = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.orchestrationState, "awaiting_d1"),
        lte(cases.d1ScheduledFor, now),
        eq(cases.caseStatus, "active"),
      ),
    )
    .limit(25);

  let processed = 0;
  for (const c of due) {
    assertTransition(
      c.orchestrationState as OrchestrationState,
      "d1_confirm",
    );
    const resv = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, c.reservationId))
      .limit(1);
    const r = resv[0];
    if (!r) continue;
    const cont = await db
      .select()
      .from(contacts)
      .where(eq(contacts.reservationId, r.id))
      .orderBy(desc(contacts.createdAt))
      .limit(1);
    const contact = cont[0];
    const to = normalizeToE164(contact?.phone ?? r.sourcePhone);
    if (!to) continue;
    const lang = (contact?.preferredLanguage ?? "en").slice(0, 2) as
      | "en"
      | "pt"
      | "es"
      | "fr"
      | "de";
    const body =
      lang === "pt"
        ? `Olá! Confirma o seu transfer amanhã de ${r.pickupLocation ?? "?"} para ${r.dropoffLocation ?? "?"}? Responda SIM ou NÃO.`
        : `Hello! Please confirm your transfer tomorrow from ${r.pickupLocation ?? "?"} to ${r.dropoffLocation ?? "?"}? Reply YES or NO.`;
    const send = await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    if (send.ok) {
      await db.insert(messages).values({
        caseId: c.id,
        direction: "outbound",
        channel: send.channel,
        body,
        providerMessageId: send.providerMessageId,
        status: "sent",
      });
    }
    await db
      .update(cases)
      .set({
        orchestrationState: "d1_confirm",
        updatedAt: new Date(),
      })
      .where(eq(cases.id, c.id));
    await writeBehaviouralEvent({
      eventType: "d1_confirmation_requested",
      caseId: c.id,
      reservationId: r.id,
    });
    processed += 1;
  }
  return { processed };
}

export async function processRetries(): Promise<{ bumped: number }> {
  const db = getDb();
  if (isQuietHourNow()) {
    return { bumped: 0 };
  }
  const stuck = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.orchestrationState, "identity_confirm"),
        lte(cases.nextRetryAt, new Date()),
        eq(cases.caseStatus, "active"),
      ),
    )
    .limit(25);

  let bumped = 0;
  for (const c of stuck) {
    if (c.attemptCount >= maxOutboundAttempts()) {
      await db
        .update(cases)
        .set({
          currentChannel: "sms",
          updatedAt: new Date(),
        })
        .where(eq(cases.id, c.id));
      await writeBehaviouralEvent({
        eventType: "fallback_sms_triggered",
        caseId: c.id,
        reservationId: c.reservationId,
      });
    }
    const resv = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, c.reservationId))
      .limit(1);
    const r = resv[0];
    if (!r) continue;
    const cont = await db
      .select()
      .from(contacts)
      .where(eq(contacts.reservationId, r.id))
      .orderBy(desc(contacts.createdAt))
      .limit(1);
    const contact = cont[0];
    const to = normalizeToE164(contact?.phone ?? r.sourcePhone);
    if (!to) continue;
    const body = `Reminder: please confirm this number is correct for your Geotravel transfer (ref ${r.externalBookingId}). Reply YES.`;
    await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    await db
      .update(cases)
      .set({
        attemptCount: c.attemptCount + 1,
        nextRetryAt: new Date(
          Date.now() + defaultRetryDelayMinutes() * 60 * 1000,
        ),
        updatedAt: new Date(),
      })
      .where(eq(cases.id, c.id));
    bumped += 1;
  }
  return { bumped };
}
