import { assertNoError } from "@/db/supabase-helpers";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { buildBookingWhatsappTemplateVariables } from "@/lib/geotravel/build-booking-whatsapp-template-variables";
import {
  buildBookingWelcomeTemplateBody,
  buildGeotravelWhatsAppConfirmationMessage,
  resolveBookingConfirmTemplateLanguage,
} from "@/lib/geotravel/geotravel-confirmation-message";
import {
  type GeotravelWhatsappLifecycleTemplate,
  resolveMetaTemplateName,
  selectBookingWhatsappTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";
import { resolveBookingTemplateFirstName } from "@/lib/geotravel/resolve-booking-template-first-name";
import { ensureReservationCaseFromGeotravel } from "@/lib/geotravel/sync-geotravel-booking-to-case";
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
import { allowsOperationalEnrichmentForPhase } from "@/lib/geotravel/whatsapp-template-ai-context";
import { mergeLastWhatsappLifecyclePhase } from "@/lib/orchestration/resolve-whatsapp-template-context";
import { defaultRetryDelayMinutes } from "@/lib/scheduling/quiet-hours";
import { serviceSupabase } from "@/lib/supabase/service-role";
import type { CollectedDataJson } from "@/db/schema";

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type GeotravelWelcomeSendSuccess = {
  ok: true;
  caseId: string;
  channel: "whatsapp" | "sms";
  providerMessageId: string | null;
  templateUsed: boolean;
  templateName?: string;
  templatePhase?: string;
  templateSelectionReason?: string;
  hoursUntilPickup?: number | null;
  templateLanguageSent?: string;
  firstNameUsed?: string;
  whatsappFallbackToSms: boolean;
  whatsappAttemptError?: string;
  whatsappRecoveryHint?: string;
  destinationE164: string;
  smsProviderMeta?: { destinationDigits?: string; status?: string };
};

export type GeotravelWelcomeSendFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

export type GeotravelWelcomeSendResult =
  | GeotravelWelcomeSendSuccess
  | GeotravelWelcomeSendFailure;

/**
 * Syncs reservation/case from the booking row, sends welcome (template when configured),
 * stores outbound message, and may advance orchestration from awaiting_outreach.
 */
export type GeotravelWelcomeSendOptions = {
  /** Staff testing: force a lifecycle template (welcome_1, welcome_2, data, canceled, satisfaction). */
  templateOverride?: GeotravelWhatsappLifecycleTemplate;
  /** When false, uses WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME from env (legacy). Default true for admin sends. */
  useLifecycleTemplates?: boolean;
  /** Inngest pilot automation: marks case so cron does not send again (one message per case). */
  fromLifecycleAutomation?: boolean;
};

export async function executeGeotravelWelcomeSend(
  booking: GeotravelBooking,
  options: GeotravelWelcomeSendOptions = {},
): Promise<GeotravelWelcomeSendResult> {
  const useLifecycle = options.useLifecycleTemplates !== false;
  let ctx;
  try {
    ctx = await ensureReservationCaseFromGeotravel(booking);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 500, body: { error: `sync_failed:${msg}` } };
  }

  const longBodyText = buildGeotravelWhatsAppConfirmationMessage(booking);
  const to = normalizeGeotravelPhoneToE164(booking.passenger_phone, {
    defaultCountryCode: "351",
  });
  if (!to) {
    return { ok: false, status: 400, body: { error: "no_phone" } };
  }

  const selection = useLifecycle
    ? selectBookingWhatsappTemplate(booking)
    : null;
  const lifecyclePhase: GeotravelWhatsappLifecycleTemplate | undefined =
    options.templateOverride ?? selection?.phase;
  const templateName = lifecyclePhase
    ? resolveMetaTemplateName(lifecyclePhase)
    : process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME?.trim() ||
      "booking_confirmation";
  const templateLanguageCode = resolveBookingConfirmTemplateLanguage(
    templateName,
    { booking, destinationE164: to },
  );

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
  const useWaTemplate = preferred === "whatsapp" && Boolean(templateName);
  const templateVariables = useWaTemplate
    ? buildBookingWhatsappTemplateVariables(booking, templateName, firstName)
    : undefined;
  const welcomeBody = useWaTemplate
    ? templateVariables
      ? `[WhatsApp template: ${templateName}]\n${Object.entries(templateVariables)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`
      : `[WhatsApp template: ${templateName}]`
    : buildBookingWelcomeTemplateBody(firstName);

  const send = await sendViaPreferredChannel({
    caseId: ctx.caseId,
    reservationId: ctx.reservationPk,
    preferred,
    toE164: to,
    body: useWaTemplate ? welcomeBody : longBodyText,
    templateName: useWaTemplate ? templateName : undefined,
    templateVariables,
    templateLanguageCode,
  });

  if (!send.ok) {
    return {
      ok: false,
      status: 502,
      body: {
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
                          const is132000 =
                            /132000|Number of parameters does not match/i.test(
                              err,
                            );
                          if (is132000) {
                            return [
                              `Error 132000: parameter count/name mismatch for template "${templateName}".`,
                              "Run: npm run whatsapp:template-params — variables must match each template body.",
                              "welcome_1/2/canceled: operator, plateform, booking_reference, pickup_date_time. data: operator, plateform, pickup_city, dropoff_city, pickup_date_time (no booking_reference). satisfaction: none. Run: npm run whatsapp:template-params",
                            ].join(" ");
                          }
                          const is132001 = /132001|does not exist in the translation/i.test(
                            err,
                          );
                          if (is132001) {
                            return [
                              `Error 132001: Meta has no "${templateName}" template for language "${templateLanguageCode}" on this WhatsApp Business Account.`,
                              "This is not caused by “Qualidade pendente” in the UI — booking_confirmation can show the same and still send.",
                              "Usually the template name/language is missing from the API for this WABA (wrong Meta business, typo, or template only in the dashboard but not on account",
                              `${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "WHATSAPP_BUSINESS_ACCOUNT_ID"}).`,
                              "Run: npm run whatsapp:list-templates — only use name + language rows that appear there.",
                            ].join(" ");
                          }
                          const is131030 =
                            /131030|not in allowed list|Recipient phone number not in allowed/i.test(
                              err,
                            );
                          if (is131030) {
                            return [
                              `Meta error 131030: ${to} is not on this app's test recipient list (development mode).`,
                              "Meta → App → WhatsApp → API Setup → manage test numbers: remove +351966915976 and re-add with SMS verification.",
                              "API must use full international digits (351966915976), not national-only 966915976.",
                              "Run: npm run whatsapp:send-probe — compares 966 vs 930 on hello_world.",
                            ].join(" ");
                          }
                          const is131005 =
                            /131005|OAuthException.*Access denied|Access denied/i.test(
                              err,
                            );
                          if (is131005) {
                            return [
                              `Meta error 131005 for destination ${to}.`,
                              "If other pilot numbers (e.g. 930) still work, the token is fine — re-verify this number in Meta test recipients or check the handset has not blocked the test business.",
                              "Remove +351966915976 from API Setup test list, re-add, confirm SMS, then send hello_world to that number on Meta's page first.",
                              "Run: npm run whatsapp:send-probe",
                            ].join(" ");
                          }
                          const is190 =
                            /\bcode=190\b|OAuthException.*\b190\b|\b190\b.*OAuthException/i.test(
                              err,
                            ) || /Invalid OAuth|Session has expired|access token/i.test(err);
                          if (is190) {
                            return [
                              "Meta error 190 (OAuthException): WHATSAPP_ACCESS_TOKEN is invalid, expired, or revoked — Meta rejects the request before template name/language matter.",
                              "Fix: generate a new token in Meta (prefer a System User permanent token for the WhatsApp app), paste it into WHATSAPP_ACCESS_TOKEN (Vercel Production / Preview as needed), redeploy.",
                              "Verify: https://developers.facebook.com/tools/debug/accesstoken/ — look for expiry and app/WABA alignment.",
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
    };
  }

  const messageBodyForStore =
    send.ok && send.channel === "whatsapp" && useWaTemplate
      ? welcomeBody
      : longBodyText;

  const sb = serviceSupabase();

  assertNoError(
    "geotravel whatsapp insert message",
    await sb.from("messages").insert({
      case_id: ctx.caseId,
      direction: "outbound",
      channel: send.channel,
      body: messageBodyForStore,
      provider_message_id: send.providerMessageId,
      status: "sent",
      metadata:
        useWaTemplate && lifecyclePhase
          ? {
              lifecycle_phase: lifecyclePhase,
              meta_template_name: templateName,
              template_language: templateLanguageCode,
            }
          : null,
    }),
  );

  if (lifecyclePhase) {
    const caseRes = await sb
      .from("cases")
      .select("collected_data")
      .eq("id", ctx.caseId)
      .maybeSingle();
    if (!caseRes.error && caseRes.data) {
      const collected = (caseRes.data.collected_data as CollectedDataJson) ?? {};
      const merged = mergeLastWhatsappLifecyclePhase(collected, lifecyclePhase);
      const withAutomation = options.fromLifecycleAutomation
        ? {
            ...merged,
            lifecycle_automation_sent_at: new Date().toISOString(),
            lifecycle_automation_phase: lifecyclePhase,
          }
        : merged;
      assertNoError(
        "geotravel case last template phase",
        await sb
          .from("cases")
          .update({
            collected_data: withAutomation,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ctx.caseId),
      );
    }
  } else if (options.fromLifecycleAutomation && send.ok) {
    const caseRes = await sb
      .from("cases")
      .select("collected_data")
      .eq("id", ctx.caseId)
      .maybeSingle();
    if (!caseRes.error && caseRes.data) {
      const collected = (caseRes.data.collected_data as CollectedDataJson) ?? {};
      assertNoError(
        "geotravel case lifecycle automation flag",
        await sb
          .from("cases")
          .update({
            collected_data: {
              ...collected,
              lifecycle_automation_sent_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", ctx.caseId),
      );
    }
  }

  const from = ctx.orchestrationState as OrchestrationState;
  const advanceToIdentityConfirm =
    !lifecyclePhase ||
    allowsOperationalEnrichmentForPhase(lifecyclePhase);
  if (
    from === "awaiting_outreach" &&
    advanceToIdentityConfirm &&
    canTransition(from, "identity_confirm")
  ) {
    assertTransition(from, "identity_confirm");
    assertNoError(
      "geotravel whatsapp case transition",
      await sb
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

  return {
    ok: true,
    caseId: ctx.caseId,
    channel: send.channel,
    providerMessageId: send.providerMessageId,
    templateUsed: useWaTemplate,
    templateName: useWaTemplate ? templateName : undefined,
    templatePhase: lifecyclePhase,
    templateSelectionReason: options.templateOverride
      ? `Manual test: ${options.templateOverride}`
      : selection?.reason,
    hoursUntilPickup: selection?.hoursUntilPickup ?? null,
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
  };
}
