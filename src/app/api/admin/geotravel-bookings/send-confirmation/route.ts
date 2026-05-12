import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNoError } from "@/db/supabase-helpers";
import { requireStaff } from "@/lib/auth/require-staff";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  buildBookingWelcomeTemplateBody,
  buildGeotravelWhatsAppConfirmationMessage,
  isBookingEligibleForWhatsAppConfirmation,
  WHATSAPP_PILOT_PHONE_DIGITS,
} from "@/lib/geotravel/geotravel-confirmation-message";
import { ensureReservationCaseFromGeotravel } from "@/lib/geotravel/sync-geotravel-booking-to-case";
import { resolveBookingTemplateFirstName } from "@/lib/geotravel/resolve-booking-template-first-name";
import {
  isWhatsappSmsFallbackEnabled,
  sendViaPreferredChannel,
} from "@/lib/messaging/send-via-channel";
import { normalizeGeotravelPhoneToE164 } from "@/lib/phone/normalize-geotravel-e164";
import {
  assertTransition,
  canTransition,
  type OrchestrationState,
} from "@/lib/orchestration/state-machine";
import { defaultRetryDelayMinutes } from "@/lib/scheduling/quiet-hours";
import { serviceSupabase } from "@/lib/supabase/service-role";

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

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

  const longBodyText = buildGeotravelWhatsAppConfirmationMessage(booking);
  const to = normalizeGeotravelPhoneToE164(booking.passenger_phone, {
    defaultCountryCode: "351",
  });
  if (!to) {
    return NextResponse.json({ error: "no_phone" }, { status: 400 });
  }

  const templateName = process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME?.trim();

  /**
   * Meta matches (template name, language code) exactly — "English" in the UI is often `en` or `en_US`, not interchangeable.
   * Default `en` avoids inheriting pt_PT from WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE. Override if Manager shows another code.
   */
  const templateLanguageCode =
    process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_LANGUAGE?.trim() || "en";

  /** Prefer Meta when a template is configured; else use case channel. Force SMS skips WhatsApp entirely. */
  const forceSms = envTruthy("GEOTRAVEL_BOOKING_CONFIRM_FORCE_SMS");
  const preferred: "whatsapp" | "sms" = forceSms
    ? "sms"
    : templateName
      ? "whatsapp"
      : (ctx.currentChannel as "whatsapp" | "sms");

  const firstName = await resolveBookingTemplateFirstName(
    serviceSupabase(),
    ctx.reservationPk,
    booking,
  );
  const welcomeBody = buildBookingWelcomeTemplateBody(firstName);
  const useWaTemplate = preferred === "whatsapp" && Boolean(templateName);

  const send = await sendViaPreferredChannel({
    caseId: ctx.caseId,
    reservationId: ctx.reservationPk,
    preferred,
    toE164: to,
    body: useWaTemplate ? welcomeBody : longBodyText,
    templateName: useWaTemplate ? templateName : undefined,
    templateVariables: useWaTemplate ? { first_name: firstName } : undefined,
    templateLanguageCode,
  });

  if (!send.ok) {
    return NextResponse.json(
      {
        error: send.error,
        hint:
          send.error === "whatsapp_not_configured"
            ? "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local."
            : send.error === "infobip_not_configured"
              ? "Set INFOBIP_BASE_URL, INFOBIP_API_KEY, and INFOBIP_SMS_SENDER in .env.local and restart the dev server."
              : send.error.startsWith("infobip_sms_rejected:") &&
                  /NOT_ENOUGH_CREDITS|5754/i.test(send.error)
                ? "Infobip rejected the send: add credits or fix billing in the Infobip portal (REJECTED_NOT_ENOUGH_CREDITS)."
                : send.error.startsWith("infobip_sms_rejected:")
                  ? "Infobip rejected the SMS — open Infobip logs for the full reason."
                  : preferred === "whatsapp"
                ? templateName
                  ? (() => {
                      const err = send.error ?? "";
                      const is132001 = /132001|does not exist in the translation/i.test(
                        err,
                      );
                      if (is132001) {
                        return `Error 132001: Meta has no translation for template "${templateName}" + language "${templateLanguageCode}". Copy the exact language code from WhatsApp Manager (often en or en_US for English). Set WHATSAPP_BOOKING_CONFIRM_TEMPLATE_LANGUAGE — this app defaults to en when unset.`;
                      }
                      const is131005 =
                        /131005|OAuthException.*Access denied|Access denied/i.test(
                          err,
                        );
                      if (is131005) {
                        return [
                          "Meta error 131005 (Access denied / OAuthException): the access token cannot send for this WhatsApp Business phone.",
                          "Typical fixes: (1) Use a System User permanent token (or a valid long-lived token) with whatsapp_business_messaging and whatsapp_business_management.",
                          "(2) In Business Settings, assign that System User to your WABA and to this phone number asset.",
                          "(3) Confirm WHATSAPP_PHONE_NUMBER_ID in Vercel matches the number under the same Meta app as the token.",
                          "Debug the token: https://developers.facebook.com/tools/debug/accesstoken/",
                        ].join(" ");
                      }
                      return `${!isWhatsappSmsFallbackEnabled() ? "[SMS fallback off] " : ""}Check WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME / WHATSAPP_BOOKING_CONFIRM_TEMPLATE_LANGUAGE and token (WHATSAPP_ACCESS_TOKEN). Set WHATSAPP_SMS_FALLBACK_AFTER_FAILURE=true to retry failed WhatsApp via SMS.`;
                    })()
                  : "WhatsApp may reject free-form text outside the 24h window; set WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME to an approved template or use GEOTRAVEL_BOOKING_CONFIRM_FORCE_SMS=1."
                : undefined,
        ...(templateName
          ? {
              templateNameAttempted: templateName,
              templateLanguageSent: templateLanguageCode,
            }
          : {}),
      },
      { status: 502 },
    );
  }

  const messageBodyForStore =
    send.ok && send.channel === "whatsapp" && useWaTemplate && templateName
      ? `[WhatsApp template: ${templateName}]\n${welcomeBody}`
      : longBodyText;

  assertNoError(
    "geotravel whatsapp insert message",
    await serviceSupabase().from("messages").insert({
      case_id: ctx.caseId,
      direction: "outbound",
      channel: send.channel,
      body: messageBodyForStore,
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

  return NextResponse.json({
    ok: true,
    caseId: ctx.caseId,
    channel: send.channel,
    providerMessageId: send.providerMessageId,
    templateUsed: useWaTemplate,
    templateName: useWaTemplate ? templateName : undefined,
    templateLanguageSent: useWaTemplate ? templateLanguageCode : undefined,
    firstNameUsed: useWaTemplate ? firstName : undefined,
    whatsappFallbackToSms: Boolean(send.whatsappErrorBeforeSmsFallback),
    whatsappAttemptError: send.whatsappErrorBeforeSmsFallback,
    whatsappRecoveryHint:
      send.whatsappErrorBeforeSmsFallback &&
      /auth|token|OAuth|session has expired|expired|invalid.*access|code=190/i.test(
        send.whatsappErrorBeforeSmsFallback,
      )
        ? "Regenerate WHATSAPP_ACCESS_TOKEN (Meta → App → WhatsApp → API setup). Match WHATSAPP_PHONE_NUMBER_ID to that app; restart next dev."
        : undefined,
    destinationE164: to,
    smsProviderMeta:
      send.ok && send.channel === "sms" ? send.smsProviderMeta : undefined,
  });
}
