import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNoError } from "@/db/supabase-helpers";
import { requireStaff } from "@/lib/auth/require-staff";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  buildGeotravelWhatsAppConfirmationMessage,
  isBookingEligibleForWhatsAppConfirmation,
  WHATSAPP_PILOT_PHONE_DIGITS,
} from "@/lib/geotravel/geotravel-confirmation-message";
import { ensureReservationCaseFromGeotravel } from "@/lib/geotravel/sync-geotravel-booking-to-case";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import {
  assertTransition,
  canTransition,
  type OrchestrationState,
} from "@/lib/orchestration/state-machine";
import { defaultRetryDelayMinutes } from "@/lib/scheduling/quiet-hours";
import { serviceSupabase } from "@/lib/supabase/service-role";

/** Loose schema: admin sends the row JSON from /admin/bookings. */
const bookingSchema = z
  .object({
    id: z.number(),
    status: z.string().nullable().optional(),
    outcome: z.string().nullable().optional(),
    plateform: z.string().nullable().optional(),
    booked_date: z.string().nullable().optional(),
    pickup_date_time: z.string().nullable().optional(),
    pickup_city: z.string().nullable().optional(),
    pickup_country: z.string().nullable().optional(),
    pickup_address: z.string().nullable().optional(),
    pickup_location_type: z.string().nullable().optional(),
    dropoff_city: z.string().nullable().optional(),
    dropoff_country: z.string().nullable().optional(),
    dropoff_address: z.string().nullable().optional(),
    dropoff_location_type: z.string().nullable().optional(),
    nearest_airport: z.string().nullable().optional(),
    vehicle_type: z.string().nullable().optional(),
    passenger_count: z.number().nullable().optional(),
    distance_km: z.number().nullable().optional(),
    amount: z.number().nullable().optional(),
    invoice_country: z.string().nullable().optional(),
    booking_reference: z.string().nullable().optional(),
    passenger_phone: z.string().nullable().optional(),
    passenger_name: z.string().nullable().optional(),
    loyalty_name: z.string().nullable().optional(),
    direction: z
      .union([z.enum(["IN", "OUT", "P2P"]), z.null()])
      .optional(),
    trip_type: z.enum(["one_way", "return"]).nullable().optional(),
    is_return: z.union([z.literal(0), z.literal(1)]).nullable().optional(),
    multidays: z.number().nullable().optional(),
    book_lead_time: z.string().nullable().optional(),
    pickup_dow: z.number().nullable().optional(),
  })
  .passthrough();

const bodySchema = z.object({
  booking: bookingSchema,
});

export async function POST(req: Request) {
  await requireStaff();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const booking = parsed.data.booking as GeotravelBooking;

  if (!isBookingEligibleForWhatsAppConfirmation(booking)) {
    return NextResponse.json(
      {
        error: "not_eligible",
        hint: `Only Active + CONFIRMED rows with passenger phone containing ${WHATSAPP_PILOT_PHONE_DIGITS} (pilot).`,
      },
      { status: 400 },
    );
  }

  let ctx;
  try {
    ctx = await ensureReservationCaseFromGeotravel(booking);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `sync_failed:${msg}` }, { status: 500 });
  }

  const bodyText = buildGeotravelWhatsAppConfirmationMessage(booking);
  const to = booking.passenger_phone!.replace(/\D/g, "").length >= 8
    ? `+${booking.passenger_phone!.replace(/\D/g, "")}`
    : null;
  if (!to) {
    return NextResponse.json({ error: "no_phone" }, { status: 400 });
  }

  const send = await sendViaPreferredChannel({
    caseId: ctx.caseId,
    reservationId: ctx.reservationPk,
    preferred: ctx.currentChannel as "whatsapp" | "sms",
    toE164: to,
    body: bodyText,
  });

  if (!send.ok) {
    return NextResponse.json(
      {
        error: send.error,
        hint:
          send.error === "whatsapp_not_configured"
            ? "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local."
            : ctx.currentChannel === "whatsapp"
              ? "WhatsApp may reject free-form text outside the 24h window; user should message you first or use a template."
              : undefined,
      },
      { status: 502 },
    );
  }

  assertNoError(
    "geotravel whatsapp insert message",
    await serviceSupabase().from("messages").insert({
      case_id: ctx.caseId,
      direction: "outbound",
      channel: send.channel,
      body: bodyText,
      provider_message_id: send.providerMessageId,
      status: "sent",
    }),
  );

  const from = ctx.orchestrationState as OrchestrationState;
  if (from === "awaiting_outreach" && canTransition(from, "identity_confirm")) {
    assertTransition(from, "identity_confirm");
    assertNoError(
      "geotravel whatsapp case transition",
      await serviceSupabase()
        .from("cases")
        .update({
          orchestration_state: "identity_confirm",
          attempt_count: ctx.attemptCount + 1,
          next_retry_at: new Date(
            Date.now() + defaultRetryDelayMinutes() * 60 * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ctx.caseId),
    );
  }

  return NextResponse.json({ ok: true, caseId: ctx.caseId });
}
