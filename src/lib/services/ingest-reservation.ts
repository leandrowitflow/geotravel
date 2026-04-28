import { randomUUID } from "node:crypto";
import { mapReservation } from "@/db/map-supabase";
import { assertNoError, takeSingle } from "@/db/supabase-helpers";
import type { ReservationIngestEvent } from "@/lib/contracts/ingest";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { serviceSupabase } from "@/lib/supabase/service-role";

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `+${digits}`;
}

export async function ingestReservationEvent(
  event: ReservationIngestEvent,
): Promise<
  { ok: true; reservationId: string; caseId?: string } | { ok: false; error: string }
> {
  const sb = serviceSupabase();
  const key = event.idempotency_key;
  const existing = await sb
    .from("idempotency_keys")
    .select("result")
    .eq("key", key)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, error: existing.error.message };
  }
  if (existing.data) {
    return { ok: true, reservationId: existing.data.result };
  }

  if (event.type === "create") {
    const r = event.reservation;
    const dupRes = await sb
      .from("reservations")
      .select("*")
      .eq("external_source", r.external_source)
      .eq("external_booking_id", r.external_booking_id)
      .maybeSingle();
    if (dupRes.error) {
      return { ok: false, error: dupRes.error.message };
    }
    if (dupRes.data) {
      const dup = mapReservation(dupRes.data as Record<string, unknown>);
      assertNoError(
        "idempotency insert (dup)",
        await sb.from("idempotency_keys").insert({
          key,
          result: dup.reservationId,
        }),
      );
      return { ok: true, reservationId: dup.reservationId };
    }
    const reservationId = `res_${randomUUID().slice(0, 12)}`;
    const ins = takeSingle<Record<string, unknown>>(
      "insert reservation",
      await sb
        .from("reservations")
        .insert({
          reservation_id: reservationId,
          external_source: r.external_source,
          external_booking_id: r.external_booking_id,
          pickup_datetime: r.pickup_datetime
            ? new Date(r.pickup_datetime).toISOString()
            : null,
          pickup_location: r.pickup_location,
          dropoff_location: r.dropoff_location,
          booking_status: r.booking_status,
          source_phone: r.source_phone,
          source_email: r.source_email || null,
          source_language_hint: r.source_language_hint,
          customer_name: r.customer_name,
        })
        .select("id, reservation_id")
        .single(),
    );
    const reservationPk = String(ins.id);

    const preferredLang = (r.source_language_hint || "en").toLowerCase().slice(0, 8) || "en";
    assertNoError(
      "insert contact",
      await sb.from("contacts").insert({
        reservation_id: reservationPk,
        phone: normalizePhone(r.source_phone),
        email: r.source_email?.trim() || null,
        preferred_language: preferredLang,
      }),
    );

    const caseIns = takeSingle<{ id: string }>(
      "insert case",
      await sb
        .from("cases")
        .insert({
          reservation_id: reservationPk,
          case_type: "enrichment",
          orchestration_state: "awaiting_outreach",
          current_channel: "whatsapp",
        })
        .select("id")
        .single(),
    );

    await writeBehaviouralEvent({
      eventType: "reservation_synced",
      caseId: caseIns.id,
      reservationId: reservationPk,
    });
    await writeBehaviouralEvent({
      eventType: "case_created",
      caseId: caseIns.id,
      reservationId: reservationPk,
    });

    assertNoError(
      "idempotency insert",
      await sb.from("idempotency_keys").insert({ key, result: reservationId }),
    );
    return { ok: true, reservationId, caseId: caseIns.id };
  }

  if (event.type === "update") {
    const rowRes = await sb
      .from("reservations")
      .select("*")
      .eq("external_source", event.external_source)
      .eq("external_booking_id", event.external_booking_id)
      .maybeSingle();
    if (rowRes.error) {
      return { ok: false, error: rowRes.error.message };
    }
    if (!rowRes.data) {
      return { ok: false, error: "reservation_not_found" };
    }
    const row = mapReservation(rowRes.data as Record<string, unknown>);
    const patch: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    };
    if (typeof event.changes.pickup_datetime === "string") {
      patch.pickup_datetime = new Date(
        event.changes.pickup_datetime as string,
      ).toISOString();
    }
    if (typeof event.changes.pickup_location === "string") {
      patch.pickup_location = event.changes.pickup_location;
    }
    if (typeof event.changes.dropoff_location === "string") {
      patch.dropoff_location = event.changes.dropoff_location;
    }
    assertNoError(
      "update reservation",
      await sb.from("reservations").update(patch).eq("id", row.id),
    );
    await writeBehaviouralEvent({
      eventType: "reservation_synced",
      reservationId: row.id,
      payload: { update: true },
    });
    assertNoError(
      "idempotency insert (update)",
      await sb.from("idempotency_keys").insert({ key, result: row.reservationId }),
    );
    return { ok: true, reservationId: row.reservationId };
  }

  const rowRes = await sb
    .from("reservations")
    .select("*")
    .eq("external_source", event.external_source)
    .eq("external_booking_id", event.external_booking_id)
    .maybeSingle();
  if (rowRes.error) {
    return { ok: false, error: rowRes.error.message };
  }
  if (!rowRes.data) {
    return { ok: false, error: "reservation_not_found" };
  }
  const row = mapReservation(rowRes.data as Record<string, unknown>);
  assertNoError(
    "cancel reservation",
    await sb
      .from("reservations")
      .update({
        booking_status: "cancelled",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", row.id),
  );
  assertNoError(
    "cancel cases",
    await sb
      .from("cases")
      .update({
        case_status: "cancelled",
        orchestration_state: "cancelled",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("reservation_id", row.id),
  );
  await writeBehaviouralEvent({
    eventType: "case_closed",
    reservationId: row.id,
    payload: { reason: "cancelled" },
  });
  assertNoError(
    "idempotency insert (cancel)",
    await sb.from("idempotency_keys").insert({ key, result: row.reservationId }),
  );
  return { ok: true, reservationId: row.reservationId };
}
