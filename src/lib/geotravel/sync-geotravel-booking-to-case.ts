import { randomUUID } from "node:crypto";
import { mapCase } from "@/db/map-supabase";
import { assertNoError, takeSingle } from "@/db/supabase-helpers";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { serviceSupabase } from "@/lib/supabase/service-role";

const EXTERNAL_SOURCE = "geotravel_data_api";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `+${digits}`;
}

function externalBookingId(booking: GeotravelBooking): string {
  return booking.booking_reference?.trim() || String(booking.id);
}

function routeText(
  city: string | null,
  address: string | null,
): string | null {
  const parts = [city?.trim(), address?.trim()].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" — ");
}

export type EnsuredCaseContext = {
  caseId: string;
  reservationPk: string;
  orchestrationState: string;
  attemptCount: number;
  currentChannel: string;
};

/**
 * Upserts a reservation + active case from a Geotravel API row so outbound WhatsApp
 * can use existing messaging / case tables.
 */
export async function ensureReservationCaseFromGeotravel(
  booking: GeotravelBooking,
): Promise<EnsuredCaseContext> {
  const sb = serviceSupabase();
  const extId = externalBookingId(booking);
  const phone = normalizePhone(booking.passenger_phone);
  if (!phone) {
    throw new Error("no_phone");
  }

  const pickupDt = booking.pickup_date_time
    ? new Date(booking.pickup_date_time).toISOString()
    : null;
  const pickupLoc = routeText(booking.pickup_city, booking.pickup_address);
  const dropLoc = routeText(booking.dropoff_city, booking.dropoff_address);

  const existing = await sb
    .from("reservations")
    .select("id, reservation_id")
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_booking_id", extId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data) {
    const reservationPk = String(existing.data.id);
    assertNoError(
      "geotravel sync update reservation",
      await sb
        .from("reservations")
        .update({
          pickup_datetime: pickupDt,
          pickup_location: pickupLoc,
          dropoff_location: dropLoc,
          customer_name: booking.passenger_name?.trim() || null,
          source_phone: phone,
          booking_status: "active",
          source_language_hint: "pt",
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", reservationPk),
    );

    const contactRes = await sb
      .from("contacts")
      .select("id")
      .eq("reservation_id", reservationPk)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contactRes.data?.id) {
      assertNoError(
        "geotravel sync update contact",
        await sb
          .from("contacts")
          .update({
            phone,
            preferred_language: "pt",
            updated_at: new Date().toISOString(),
          })
          .eq("id", contactRes.data.id),
      );
    }

    const caseRes = await sb
      .from("cases")
      .select("*")
      .eq("reservation_id", reservationPk)
      .eq("case_status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (caseRes.data) {
      const c = mapCase(caseRes.data as Record<string, unknown>);
      return {
        caseId: c.id,
        reservationPk,
        orchestrationState: c.orchestrationState,
        attemptCount: c.attemptCount,
        currentChannel: c.currentChannel,
      };
    }

    const caseIns = takeSingle<{ id: string }>(
      "geotravel sync insert case",
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
      eventType: "case_created",
      caseId: caseIns.id,
      reservationId: reservationPk,
      payload: { source: "geotravel_admin_whatsapp" },
    });

    return {
      caseId: caseIns.id,
      reservationPk,
      orchestrationState: "awaiting_outreach",
      attemptCount: 0,
      currentChannel: "whatsapp",
    };
  }

  const reservationId = `res_${randomUUID().slice(0, 12)}`;
  const ins = takeSingle<Record<string, unknown>>(
    "geotravel insert reservation",
    await sb
      .from("reservations")
      .insert({
        reservation_id: reservationId,
        external_source: EXTERNAL_SOURCE,
        external_booking_id: extId,
        pickup_datetime: pickupDt,
        pickup_location: pickupLoc,
        dropoff_location: dropLoc,
        booking_status: "active",
        source_phone: phone,
        source_email: null,
        source_language_hint: "pt",
        customer_name: booking.passenger_name?.trim() || null,
      })
      .select("id")
      .single(),
  );
  const reservationPk = String(ins.id);

  assertNoError(
    "geotravel insert contact",
    await sb.from("contacts").insert({
      reservation_id: reservationPk,
      phone,
      email: null,
      preferred_language: "pt",
    }),
  );

  const caseIns = takeSingle<{ id: string }>(
    "geotravel insert case",
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
    payload: { source: "geotravel_data_api" },
  });
  await writeBehaviouralEvent({
    eventType: "case_created",
    caseId: caseIns.id,
    reservationId: reservationPk,
    payload: { source: "geotravel_admin_whatsapp" },
  });

  return {
    caseId: caseIns.id,
    reservationPk,
    orchestrationState: "awaiting_outreach",
    attemptCount: 0,
    currentChannel: "whatsapp",
  };
}
