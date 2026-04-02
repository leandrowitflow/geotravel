import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `+${digits}`;
}
import { getDb } from "@/db";
import { cases, contacts, idempotencyKeys, reservations } from "@/db/schema";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import type { ReservationIngestEvent } from "@/lib/contracts/ingest";

export async function ingestReservationEvent(
  event: ReservationIngestEvent,
): Promise<{ ok: true; reservationId: string; caseId?: string } | { ok: false; error: string }> {
  const db = getDb();
  const key = event.idempotency_key;
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  if (existing[0]) {
    return { ok: true, reservationId: existing[0].result };
  }

  if (event.type === "create") {
    const r = event.reservation;
    const dup = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.externalSource, r.external_source),
          eq(reservations.externalBookingId, r.external_booking_id),
        ),
      )
      .limit(1);
    if (dup[0]) {
      await db.insert(idempotencyKeys).values({
        key,
        result: dup[0].reservationId,
      });
      return { ok: true, reservationId: dup[0].reservationId };
    }
    const reservationId = `res_${randomUUID().slice(0, 12)}`;
    const [ins] = await db
      .insert(reservations)
      .values({
        reservationId,
        externalSource: r.external_source,
        externalBookingId: r.external_booking_id,
        pickupDatetime: r.pickup_datetime ? new Date(r.pickup_datetime) : null,
        pickupLocation: r.pickup_location,
        dropoffLocation: r.dropoff_location,
        bookingStatus: r.booking_status,
        sourcePhone: r.source_phone,
        sourceEmail: r.source_email || null,
        sourceLanguageHint: r.source_language_hint,
        customerName: r.customer_name,
      })
      .returning({ id: reservations.id, reservationId: reservations.reservationId });

    const reservationPk = ins.id;
    await db.insert(contacts).values({
      reservationId: reservationPk,
      phone: normalizePhone(r.source_phone),
      email: r.source_email?.trim() || null,
      preferredLanguage: "en",
    });

    const [c] = await db
      .insert(cases)
      .values({
        reservationId: reservationPk,
        caseType: "enrichment",
        orchestrationState: "awaiting_outreach",
        currentChannel: "whatsapp",
      })
      .returning({ id: cases.id });

    await writeBehaviouralEvent({
      eventType: "reservation_synced",
      caseId: c.id,
      reservationId: reservationPk,
    });
    await writeBehaviouralEvent({
      eventType: "case_created",
      caseId: c.id,
      reservationId: reservationPk,
    });

    await db.insert(idempotencyKeys).values({ key, result: reservationId });
    return { ok: true, reservationId, caseId: c.id };
  }

  if (event.type === "update") {
    const [row] = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.externalSource, event.external_source),
          eq(reservations.externalBookingId, event.external_booking_id),
        ),
      )
      .limit(1);
    if (!row) {
      return { ok: false, error: "reservation_not_found" };
    }
    await db
      .update(reservations)
      .set({
        lastSyncedAt: new Date(),
        ...(typeof event.changes.pickup_datetime === "string"
          ? { pickupDatetime: new Date(event.changes.pickup_datetime as string) }
          : {}),
        ...(typeof event.changes.pickup_location === "string"
          ? { pickupLocation: event.changes.pickup_location as string }
          : {}),
        ...(typeof event.changes.dropoff_location === "string"
          ? { dropoffLocation: event.changes.dropoff_location as string }
          : {}),
      })
      .where(eq(reservations.id, row.id));
    await writeBehaviouralEvent({
      eventType: "reservation_synced",
      reservationId: row.id,
      payload: { update: true },
    });
    await db.insert(idempotencyKeys).values({ key, result: row.reservationId });
    return { ok: true, reservationId: row.reservationId };
  }

  // cancel
  const [row] = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.externalSource, event.external_source),
        eq(reservations.externalBookingId, event.external_booking_id),
      ),
    )
    .limit(1);
  if (!row) {
    return { ok: false, error: "reservation_not_found" };
  }
  await db
    .update(reservations)
    .set({ bookingStatus: "cancelled", lastSyncedAt: new Date() })
    .where(eq(reservations.id, row.id));
  await db
    .update(cases)
    .set({
      caseStatus: "cancelled",
      orchestrationState: "cancelled",
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cases.reservationId, row.id));
  await writeBehaviouralEvent({
    eventType: "case_closed",
    reservationId: row.id,
    payload: { reason: "cancelled" },
  });
  await db.insert(idempotencyKeys).values({ key, result: row.reservationId });
  return { ok: true, reservationId: row.reservationId };
}
