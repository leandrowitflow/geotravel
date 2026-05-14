import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  isBookingEligibleForWhatsAppConfirmation,
  whatsappPilotAllowSubstrings,
} from "@/lib/geotravel/geotravel-confirmation-message";
import { executeGeotravelWelcomeSend } from "@/lib/geotravel/execute-geotravel-welcome-send";

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
        hint: `Only Active + CONFIRMED rows whose passenger phone matches a pilot digit substring (${whatsappPilotAllowSubstrings().slice(0, 4).join(", ")}${whatsappPilotAllowSubstrings().length > 4 ? ", …" : ""}). Set GEOTRAVEL_WHATSAPP_PILOT_PHONE_SUBSTRINGS to add more.`,
      },
      { status: 400 },
    );
  }

  const result = await executeGeotravelWelcomeSend(booking);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    caseId: result.caseId,
    channel: result.channel,
    providerMessageId: result.providerMessageId,
    templateUsed: result.templateUsed,
    templateName: result.templateName,
    templateLanguageSent: result.templateLanguageSent,
    firstNameUsed: result.firstNameUsed,
    whatsappFallbackToSms: result.whatsappFallbackToSms,
    whatsappAttemptError: result.whatsappAttemptError,
    whatsappRecoveryHint: result.whatsappRecoveryHint,
    destinationE164: result.destinationE164,
    smsProviderMeta: result.smsProviderMeta,
  });
}
