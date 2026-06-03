import { mapCase, mapContact, mapReservation } from "@/db/map-supabase";
import type {
  CaseRow,
  CollectedDataJson,
  ContactRow,
  ReservationRow,
} from "@/db/schema";
import { assertNoError, takeRows } from "@/db/supabase-helpers";
import {
  detectLanguageFromText,
  generateInboundAssistantReply,
  generateOrchestrationTurnReply,
  generateWhatsappCatchAllReply,
  generateWhatsappEnrichmentAsk,
  generateWhatsappTemplateAwareReply,
  minimalAssistantFallback,
  resolveConversationLanguage,
  type OrchestrationTurnKind,
} from "@/lib/ai/pipeline";
import { assistantFallbackFromPhone } from "@/lib/ai/assistant-locale";
import { hasOpenAiConfigured } from "@/lib/ai/openai-client";
import type { UsageRecordContext } from "@/lib/usage/record-provider-usage";
import { isPortugueseRecipientPhone } from "@/lib/phone/is-portuguese-phone";
import { advanceCaseForOperationalTemplateSend } from "@/lib/orchestration/advance-case-for-operational-template";
import { applyInboundExtractionToCaseRow } from "@/lib/orchestration/apply-inbound-extraction";
import { resolveMessagingTemplateContextForCase } from "@/lib/orchestration/resolve-whatsapp-template-context";
import {
  clampSmsReply,
  isTextMessagingChannel,
  messagingAiConversationEnabled,
} from "@/lib/messaging/messaging-ai-conversation";
import { buildCollectedDataDisplayRows } from "@/lib/admin/collected-data-display";
import { buildCrmEnrichmentPayload } from "@/lib/crm/enrichment-payload";
import { syncConfirmationToCrm, syncEnrichmentToCrm } from "@/lib/crm/sync-with-retry";
import type { SupportedLanguage } from "@/lib/contracts/extraction";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import { serviceSupabase } from "@/lib/supabase/service-role";
import {
  computeOfferEligibility,
  recordConsentFromText,
} from "./commercial-layer";
import { nextMissingField } from "./field-prompts";
import { resolveInboundCaseAndContact } from "./resolve-inbound-case-and-contact";
import { assertTransition, type OrchestrationState } from "./state-machine";

function needsHumanAutoReplyEnabled(): boolean {
  const v = process.env.AI_ASSISTANT_AUTO_REPLY_ON_NEEDS_HUMAN?.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

export async function processInboundMessaging(input: {
  channel: "whatsapp" | "sms";
  fromE164: string;
  body: string;
  providerMessageId?: string;
}): Promise<
  { ok: true; replied: boolean } | { ok: false; error: string }
> {
  const sb = serviceSupabase();
  let outboundSent = false;
  const resolved = await resolveInboundCaseAndContact(input.fromE164, sb);
  if (!resolved.ok) {
    console.warn(`[pipeline] inbound resolve failed: ${resolved.reason}`, {
      fromE164: input.fromE164,
    });
    return { ok: false, error: resolved.reason };
  }
  const contact = mapContact(resolved.contactRaw);
  let caseRow = mapCase(resolved.caseRaw);

  const resRes = await sb
    .from("reservations")
    .select("*")
    .eq("id", contact.reservationId)
    .maybeSingle();
  if (resRes.error) {
    console.error("[pipeline] reservation query error:", resRes.error.message);
    return { ok: false, error: resRes.error.message };
  }
  if (!resRes.data) {
    console.warn(`[pipeline] reservation_not_found for id ${contact.reservationId}`);
    return { ok: false, error: "reservation_not_found" };
  }
  const reservation = mapReservation(resRes.data as Record<string, unknown>);

  assertNoError(
    "inbound message insert",
    await sb.from("messages").insert({
      case_id: caseRow.id,
      direction: "inbound",
      channel: input.channel,
      body: input.body,
      provider_message_id: input.providerMessageId ?? null,
      status: "received",
    }),
  );
  await writeBehaviouralEvent({
    eventType: "customer_replied",
    caseId: caseRow.id,
    reservationId: reservation.id,
    channel: input.channel,
  });

  if (input.channel === "sms" && caseRow.currentChannel !== "sms") {
    assertNoError(
      "case channel sms on inbound",
      await sb
        .from("cases")
        .update({
          current_channel: "sms",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );
    caseRow = { ...caseRow, currentChannel: "sms" };
  }

  const nowIso = new Date().toISOString();
  assertNoError(
    "case last customer message",
    await sb
      .from("cases")
      .update({
        last_customer_message_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", caseRow.id),
  );
  caseRow = { ...caseRow, lastCustomerMessageAt: new Date(nowIso) };

  const messagingTemplateContext = isTextMessagingChannel(input.channel)
    ? await resolveMessagingTemplateContextForCase(
        caseRow.id,
        caseRow.collectedData,
        sb,
      )
    : null;
  const templateOnlyConversation =
    isTextMessagingChannel(input.channel) &&
    messagingTemplateContext &&
    !messagingTemplateContext.allowsOperationalEnrichment;

  const operationalTemplateReply =
    isTextMessagingChannel(input.channel) &&
    Boolean(messagingTemplateContext?.allowsOperationalEnrichment);

  if (
    operationalTemplateReply &&
    messagingTemplateContext &&
    (caseRow.caseStatus === "closed" ||
      caseRow.orchestrationState === "cancelled" ||
      caseRow.orchestrationState === "awaiting_d1" ||
      caseRow.orchestrationState === "d1_confirm")
  ) {
    if (messagingTemplateContext.phase !== "unknown") {
      await advanceCaseForOperationalTemplateSend(
        caseRow.id,
        messagingTemplateContext.phase,
      );
      const refreshed = await sb
        .from("cases")
        .select("*")
        .eq("id", caseRow.id)
        .maybeSingle();
      if (refreshed.data) {
        caseRow = mapCase(refreshed.data as Record<string, unknown>);
      }
    }
  }

  function aiUsage(operation: string): UsageRecordContext {
    return {
      operation,
      caseId: caseRow.id,
      reservationId: reservation.id,
      channel: input.channel,
    };
  }

  caseRow = await applyInboundExtractionToCaseRow(
    caseRow,
    reservation.id,
    input.body,
    aiUsage("extract_fields"),
  );

  if (
    caseRow.caseStatus === "closed" ||
    (caseRow.orchestrationState === "cancelled" && !templateOnlyConversation)
  ) {
    return { ok: true, replied: outboundSent };
  }

  const phoneForLang =
    contact.phone ?? reservation.sourcePhone ?? input.fromE164;
  const phoneSuggestsPortuguese = isPortugueseRecipientPhone(phoneForLang);

  let langDet: Awaited<ReturnType<typeof detectLanguageFromText>>;
  try {
    langDet = await detectLanguageFromText(input.body, {
      phoneSuggestsPortuguese,
      usage: aiUsage("language_detect"),
    });
  } catch (e) {
    console.warn("[pipeline] detectLanguageFromText failed, falling back:", e);
    langDet = {
      language: phoneSuggestsPortuguese ? "pt" : "en",
      confidence: 0.3,
    };
  }
  const preferred =
    (contact.preferredLanguage as SupportedLanguage) ||
    assistantFallbackFromPhone(contact.phone ?? reservation.sourcePhone);
  const convLang = resolveConversationLanguage(langDet, preferred);
  assertNoError(
    "contact language update",
    await sb
      .from("contacts")
      .update({
        detected_language: langDet.language,
        confidence_language: String(langDet.confidence),
        preferred_language: convLang,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id),
  );
  await writeBehaviouralEvent({
    eventType: "language_detected",
    caseId: caseRow.id,
    reservationId: reservation.id,
    payload: { language: convLang, confidence: langDet.confidence },
  });

  let outboundThisTurn = false;

  async function loadTranscript(): Promise<string> {
    const rows = takeRows<{ direction: string; body: string }>(
      "recent messages for transcript",
      await sb
        .from("messages")
        .select("direction,body")
        .eq("case_id", caseRow.id)
        .order("created_at", { ascending: false })
        .limit(14),
    );
    return [...rows]
      .reverse()
      .map((r) => `${r.direction}: ${r.body}`)
      .join("\n");
  }

  function reservationBlurb(): string {
    return [
      reservation.customerName?.trim()
        ? `passenger ${reservation.customerName.trim()}`
        : null,
      `ref ${reservation.externalBookingId}`,
      reservation.pickupDatetime?.toISOString().slice(0, 16),
      reservation.pickupLocation,
      reservation.dropoffLocation,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function aiConversationReady(): boolean {
    return messagingAiConversationEnabled() && hasOpenAiConfigured();
  }

  async function resolveOrchestrationReply(
    kind: OrchestrationTurnKind,
    extra?: { summaryText?: string },
  ): Promise<string> {
    if (!aiConversationReady()) {
      return minimalAssistantFallback(convLang);
    }
    try {
      const text = await generateOrchestrationTurnReply({
        kind,
        userMessage: input.body,
        transcript: await loadTranscript(),
        language: convLang,
        reservationSummary: reservationBlurb(),
        bookingRef: reservation.externalBookingId,
        passengerName: reservation.customerName,
        whatsappTemplateContext: messagingTemplateContext,
        channel: input.channel,
        summaryText: extra?.summaryText,
        usage: aiUsage(`orchestration_${kind}`),
      });
      if (text) return text;
    } catch (e) {
      console.warn(`[pipeline] generateOrchestrationTurnReply(${kind}) failed:`, e);
    }
    return minimalAssistantFallback(convLang);
  }

  async function resolveEnrichmentAsk(fieldKey: string): Promise<string> {
    if (!aiConversationReady()) {
      return minimalAssistantFallback(convLang);
    }
    try {
      const text = await generateWhatsappEnrichmentAsk({
        fieldKey,
        userMessage: input.body,
        transcript: await loadTranscript(),
        language: convLang,
        reservationSummary: reservationBlurb(),
        passengerName: reservation.customerName,
        whatsappTemplateContext: messagingTemplateContext,
        channel: input.channel,
        usage: aiUsage("enrichment_ask"),
      });
      if (text) return text;
    } catch (e) {
      console.warn("[pipeline] generateWhatsappEnrichmentAsk failed:", e);
    }
    return minimalAssistantFallback(convLang);
  }

  async function resolveTemplateAwareReply(): Promise<string> {
    if (!aiConversationReady() || !messagingTemplateContext) {
      return minimalAssistantFallback(convLang);
    }
    try {
      const text = await generateWhatsappTemplateAwareReply({
        userMessage: input.body,
        language: convLang,
        transcript: await loadTranscript(),
        reservationSummary: reservationBlurb(),
        bookingRef: reservation.externalBookingId,
        passengerName: reservation.customerName,
        whatsappTemplateContext: messagingTemplateContext,
        channel: input.channel,
        usage: aiUsage("template_aware_reply"),
      });
      if (text) return text;
    } catch (e) {
      console.warn("[pipeline] generateWhatsappTemplateAwareReply failed:", e);
    }
    return minimalAssistantFallback(convLang);
  }

  async function resolveCatchAllReply(orchestrationState: string): Promise<string> {
    if (!aiConversationReady()) {
      return minimalAssistantFallback(convLang);
    }
    try {
      const text = await generateWhatsappCatchAllReply({
        userMessage: input.body,
        language: convLang,
        orchestrationState,
        transcript: await loadTranscript(),
        reservationSummary: reservationBlurb(),
        bookingRef: reservation.externalBookingId,
        passengerName: reservation.customerName,
        whatsappTemplateContext: messagingTemplateContext,
        channel: input.channel,
        usage: aiUsage("catch_all_reply"),
      });
      if (text) return text;
    } catch (e) {
      console.warn("[pipeline] generateWhatsappCatchAllReply failed:", e);
    }
    return minimalAssistantFallback(convLang);
  }

  async function deliverOutbound(text: string) {
    outboundThisTurn = true;
    let out = text;
    if (input.channel === "sms") {
      out = clampSmsReply(out);
    }
    const sent = await sendReply(
      caseRow,
      reservation,
      contact,
      out,
      input.channel,
      (ok) => {
        if (ok) outboundSent = true;
      },
    );
    if (!sent) {
      console.warn("[pipeline] deliverOutbound: SMS/WhatsApp reply not sent", {
        caseId: caseRow.id,
        channel: input.channel,
      });
    }
  }

  if (caseRow.orchestrationState === "needs_human") {
    if (needsHumanAutoReplyEnabled()) {
      const pickupSummary = [
        reservation.pickupDatetime?.toISOString().slice(0, 16),
        reservation.pickupLocation,
        reservation.dropoffLocation,
      ]
        .filter(Boolean)
        .join(" · ");
      let aiText: string | null = null;
      try {
        aiText = await generateInboundAssistantReply({
          userMessage: input.body,
          language: convLang,
          bookingRef: reservation.externalBookingId,
          pickupSummary: pickupSummary || null,
          passengerName: reservation.customerName,
          whatsappTemplateContext: messagingTemplateContext,
          channel: input.channel,
          usage: aiUsage("needs_human_ack"),
        });
      } catch (e) {
        console.warn("[processInboundMessaging] generateInboundAssistantReply failed:", e);
      }
      const reply = aiText ?? minimalAssistantFallback(convLang);
      await deliverOutbound(reply);
    }
    return { ok: true, replied: outboundSent };
  }

  let state = caseRow.orchestrationState as OrchestrationState;

  if (templateOnlyConversation && messagingTemplateContext) {
    await deliverOutbound(await resolveTemplateAwareReply());
    return { ok: true, replied: outboundSent };
  }

  if (state === "consent_future_comms") {
    const consent = recordConsentFromText(input.body, caseRow.consent ?? {});
    assertTransition(state, "commercial_eligible");
    assertNoError(
      "case consent update",
      await sb
        .from("cases")
        .update({
          consent,
          consent_status: consent.consent_future_marketing
            ? "granted"
            : "declined",
          orchestration_state: "commercial_eligible",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );
    await writeBehaviouralEvent({
      eventType: consent.consent_future_marketing
        ? "consent_granted"
        : "consent_declined",
      caseId: caseRow.id,
      reservationId: reservation.id,
    });
    await sendCommercialIfEligible(
      { ...caseRow, consent, orchestrationState: "commercial_eligible" },
      reservation,
      contact,
      convLang,
      deliverOutbound,
      () => resolveOrchestrationReply("commercial_return"),
    );
    return { ok: true, replied: outboundSent };
  }

  if (state === "d1_confirm") {
    const lower = input.body.toLowerCase();
    const confirmed =
      /\byes\b|sim|sí|oui|ja|ok|confirm/i.test(lower) &&
      !/\bno\b|não|non|nein/i.test(lower);
    await writeBehaviouralEvent({
      eventType: confirmed ? "d1_confirmed" : "d1_not_confirmed",
      caseId: caseRow.id,
      reservationId: reservation.id,
    });
    await syncConfirmationToCrm({
      caseId: caseRow.id,
      reservationId: reservation.id,
      payload: {
        external_source: reservation.externalSource,
        external_booking_id: reservation.externalBookingId,
        d1_confirmed: confirmed,
        d1_recorded_at: new Date().toISOString(),
      },
    });
    assertTransition(state, "consent_future_comms");
    assertNoError(
      "case d1 -> consent",
      await sb
        .from("cases")
        .update({
          orchestration_state: "consent_future_comms",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );
    await deliverOutbound(
      await resolveOrchestrationReply("consent_future_comms"),
    );
    return { ok: true, replied: outboundSent };
  }

  if (state === "summarize_confirm") {
    const lower = input.body.toLowerCase();
    const yes =
      /\byes\b|correct|sim|sí|oui|ja|ok/i.test(lower) &&
      !/\bno\b|não|non|nein/i.test(lower);
    if (yes) {
      assertTransition(state, "crm_write_enrichment");
      assertNoError(
        "case -> crm_write",
        await sb
          .from("cases")
          .update({
            orchestration_state: "crm_write_enrichment",
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseRow.id),
      );
      const collected = (caseRow.collectedData ?? {}) as CollectedDataJson;
      const crmPayload = buildCrmEnrichmentPayload(reservation, collected);
      const sync = await syncEnrichmentToCrm({
        caseId: caseRow.id,
        reservationId: reservation.id,
        payload: crmPayload,
      });
      if (!sync.ok) {
        assertNoError(
          "case crm fail",
          await sb
            .from("cases")
            .update({
              exception_flag: true,
              orchestration_state: "needs_human",
              updated_at: new Date().toISOString(),
            })
            .eq("id", caseRow.id),
        );
        if (isTextMessagingChannel(input.channel)) {
          await deliverOutbound(
            await resolveOrchestrationReply("crm_sync_failed"),
          );
        }
        return { ok: true, replied: outboundSent };
      }
      assertTransition("crm_write_enrichment", "awaiting_d1");
      const pickup = reservation.pickupDatetime;
      const d1 = pickup
        ? new Date(pickup.getTime() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const offer = computeOfferEligibility(reservation, collected);
      assertNoError(
        "case enrichment complete",
        await sb
          .from("cases")
          .update({
            orchestration_state: "awaiting_d1",
            enrichment_status: "complete",
            operational_complete: true,
            d1_scheduled_for: d1.toISOString(),
            offer_signal: offer,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseRow.id),
      );
      await writeBehaviouralEvent({
        eventType: "offer_eligibility_detected",
        caseId: caseRow.id,
        reservationId: reservation.id,
        payload: offer,
      });
      await deliverOutbound(
        await resolveOrchestrationReply("enrichment_complete_ack"),
      );
      return { ok: true, replied: outboundSent };
    }
    assertTransition(state, "collect_missing");
    assertNoError(
      "case summarize -> collect",
      await sb
        .from("cases")
        .update({
          orchestration_state: "collect_missing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );
    await deliverOutbound(
      await resolveOrchestrationReply("summarize_correction"),
    );
    return { ok: true, replied: outboundSent };
  }

  if (state === "commercial_eligible") {
    await sendCommercialIfEligible(
      caseRow,
      reservation,
      contact,
      convLang,
      deliverOutbound,
      () => resolveOrchestrationReply("commercial_return"),
    );
    return { ok: true, replied: outboundSent };
  }

  if (
    state === "identity_confirm" ||
    state === "awaiting_outreach" ||
    state === "collect_missing"
  ) {
    if (state === "awaiting_outreach") {
      assertTransition(state, "identity_confirm");
      assertNoError(
        "case awaiting -> identity",
        await sb
          .from("cases")
          .update({
            orchestration_state: "identity_confirm",
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseRow.id),
      );
      state = "identity_confirm";
    }

    const merged = (caseRow.collectedData ?? {}) as CollectedDataJson;

    assertTransition(state, "collect_missing");
    assertNoError(
      "case collected data",
      await sb
        .from("cases")
        .update({
          collected_data: merged,
          orchestration_state: "collect_missing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );

    const missing = nextMissingField(merged);
    if (missing) {
      assertNoError(
        "case pending field",
        await sb
          .from("cases")
          .update({
            pending_field_key: missing,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseRow.id),
      );
      await writeBehaviouralEvent({
        eventType: "field_requested",
        caseId: caseRow.id,
        reservationId: reservation.id,
        payload: { field: missing },
      });
      await deliverOutbound(await resolveEnrichmentAsk(missing));
      return { ok: true, replied: outboundSent };
    }

    assertTransition("collect_missing", "summarize_confirm");
    const summary = formatSummaryForAi(merged);
    assertNoError(
      "case summarize_confirm",
      await sb
        .from("cases")
        .update({
          orchestration_state: "summarize_confirm",
          pending_field_key: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseRow.id),
    );
    await deliverOutbound(
      await resolveOrchestrationReply("present_summary", {
        summaryText: summary,
      }),
    );
    return { ok: true, replied: outboundSent };
  }

  const freshStateRes = await sb
    .from("cases")
    .select("orchestration_state")
    .eq("id", caseRow.id)
    .maybeSingle();
  const orchestrationNow = String(
    freshStateRes.data?.orchestration_state ?? caseRow.orchestrationState,
  );

  /** Fallback when no scripted branch sent this turn (e.g. awaiting_d1). Must not depend on WHATSAPP_AI_CONVERSATION — that flag only gates GPT polish, not whether we reply at all. */
  if (
    isTextMessagingChannel(input.channel) &&
    !outboundThisTurn &&
    orchestrationNow !== "closed" &&
    orchestrationNow !== "cancelled"
  ) {
    await deliverOutbound(await resolveCatchAllReply(orchestrationNow));
  }

  return { ok: true, replied: outboundSent };
}

async function sendCommercialIfEligible(
  caseRow: CaseRow,
  reservation: ReservationRow,
  contact: ContactRow,
  convLang: SupportedLanguage,
  deliver: (text: string) => Promise<void>,
  commercialReply: () => Promise<string>,
) {
  const offer = (caseRow.offerSignal ?? {}) as {
    return_transfer_eligible?: boolean;
  };
  if (offer.return_transfer_eligible) {
    await writeBehaviouralEvent({
      eventType: "offer_shown",
      caseId: caseRow.id,
      reservationId: reservation.id,
      payload: { type: "return_transfer" },
    });
    await deliver(await commercialReply());
  }
  assertTransition(
    caseRow.orchestrationState as OrchestrationState,
    "closed",
  );
  const sb = serviceSupabase();
  assertNoError(
    "case closed commercial",
    await sb
      .from("cases")
      .update({
        orchestration_state: "closed",
        case_status: "closed",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseRow.id),
  );
  await writeBehaviouralEvent({
    eventType: "case_closed",
    caseId: caseRow.id,
    reservationId: reservation.id,
  });
}

async function sendReply(
  caseRow: CaseRow,
  reservation: ReservationRow,
  contact: ContactRow,
  text: string,
  preferredChannel: "whatsapp" | "sms",
  onSent?: (sent: boolean) => void,
) {
  const to = contact.phone ?? reservation.sourcePhone;
  if (!to) {
    console.warn("[pipeline] sendReply skipped — no phone on contact or reservation");
    onSent?.(false);
    return false;
  }
  const toE164 = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
  const send = await sendViaPreferredChannel({
    caseId: caseRow.id,
    reservationId: reservation.id,
    preferred: preferredChannel,
    toE164,
    body: text,
  });
  if (!send.ok) {
    console.warn("[pipeline] outbound send failed", {
      caseId: caseRow.id,
      preferredChannel,
      error: send.error,
    });
    try {
      await writeBehaviouralEvent({
        eventType: "outbound_send_failed",
        caseId: caseRow.id,
        reservationId: reservation.id,
        channel: preferredChannel,
        payload: {
          error: send.error,
          excerpt: text.slice(0, 240),
        },
      });
    } catch {
      /* do not fail webhook on telemetry */
    }
    onSent?.(false);
    return false;
  }
  const sb = serviceSupabase();
  assertNoError(
    "outbound reply message",
    await sb.from("messages").insert({
      case_id: caseRow.id,
      direction: "outbound",
      channel: send.channel,
      body: text,
      provider_message_id: send.providerMessageId,
      status: "sent",
    }),
  );
  onSent?.(true);
  return true;
}

/** Facts for the AI to present naturally (no rigid yes/no footer). */
function formatSummaryForAi(data: CollectedDataJson): string {
  const rows = buildCollectedDataDisplayRows(data);
  return rows.map((row) => `${row.label}: ${row.value}`).join("\n");
}
