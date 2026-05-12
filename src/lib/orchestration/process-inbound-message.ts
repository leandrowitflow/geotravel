import { mapCase, mapContact, mapReservation } from "@/db/map-supabase";
import type {
  CaseRow,
  CollectedDataJson,
  ContactRow,
  ReservationRow,
} from "@/db/schema";
import { assertNoError, takeRows } from "@/db/supabase-helpers";
import {
  cannedCrmHandoffAfterSyncFail,
  cannedNeedsHumanAck,
  cannedWhatsappCatchAllReply,
  detectLanguageFromText,
  extractOperationalFields,
  generateInboundAssistantReply,
  generateWhatsappCatchAllReply,
  generateWhatsappEnrichmentAsk,
  mergeExtraction,
  naturalizeWhatsappReply,
  resolveConversationLanguage,
} from "@/lib/ai/pipeline";
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
import { nextMissingField, promptForField } from "./field-prompts";
import { resolveContactForInboundPhone } from "./resolve-contact-for-inbound";
import { assertTransition, type OrchestrationState } from "./state-machine";

function needsHumanAutoReplyEnabled(): boolean {
  const v = process.env.AI_ASSISTANT_AUTO_REPLY_ON_NEEDS_HUMAN?.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

function whatsappConversationFeaturesEnabled(): boolean {
  const v = process.env.WHATSAPP_AI_CONVERSATION?.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

export async function processInboundMessaging(input: {
  channel: "whatsapp" | "sms";
  fromE164: string;
  body: string;
  providerMessageId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const TAG = "[pipeline]";
  console.log(`${TAG} ④ resolving contact for ${input.fromE164}`);

  const sb = serviceSupabase();
  const resolved = await resolveContactForInboundPhone(input.fromE164, sb);
  if (!resolved.ok) {
    console.warn(`${TAG} ✗ unknown_contact — no contact/reservation row matches ${input.fromE164}. Check contacts.phone and reservations.source_phone in the DB.`);
    return { ok: false, error: "unknown_contact" };
  }
  const contact = mapContact(resolved.contactRaw);
  console.log(`${TAG} ⑤ contact found`, { contactId: contact.id, reservationId: contact.reservationId });

  const resRes = await sb
    .from("reservations")
    .select("*")
    .eq("id", contact.reservationId)
    .maybeSingle();
  if (resRes.error) {
    console.error(`${TAG} ✗ reservation query error:`, resRes.error.message);
    return { ok: false, error: resRes.error.message };
  }
  if (!resRes.data) {
    console.warn(`${TAG} ✗ reservation_not_found for id ${contact.reservationId}`);
    return { ok: false, error: "reservation_not_found" };
  }
  const reservation = mapReservation(resRes.data as Record<string, unknown>);
  console.log(`${TAG} ⑤ reservation found`, { externalBookingId: reservation.externalBookingId });

  const caseRows = takeRows<Record<string, unknown>>(
    "case for reservation",
    await sb
      .from("cases")
      .select("*")
      .eq("reservation_id", reservation.id)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const caseRowRaw = caseRows[0];
  if (!caseRowRaw) {
    console.warn(`${TAG} ✗ case_not_found for reservation ${reservation.id}`);
    return { ok: false, error: "case_not_found" };
  }
  const caseRow = mapCase(caseRowRaw);
  console.log(`${TAG} ⑤ case found`, { caseId: caseRow.id, orchestrationState: caseRow.orchestrationState, caseStatus: caseRow.caseStatus });

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
  console.log(`${TAG} ⑥ inbound message row saved to DB`);

  await writeBehaviouralEvent({
    eventType: "customer_replied",
    caseId: caseRow.id,
    reservationId: reservation.id,
    channel: input.channel,
  });

  if (
    caseRow.caseStatus === "closed" ||
    caseRow.orchestrationState === "cancelled"
  ) {
    console.log(`${TAG} case is ${caseRow.caseStatus}/${caseRow.orchestrationState} — no reply sent`);
    return { ok: true };
  }

  console.log(`${TAG} ⑥ detecting language (OpenAI)…`);
  let langDet: Awaited<ReturnType<typeof detectLanguageFromText>>;
  try {
    langDet = await detectLanguageFromText(input.body);
    console.log(`${TAG} ⑥ language detected:`, langDet);
  } catch (e) {
    console.warn(`${TAG} ✗ detectLanguageFromText failed (falling back to en):`, e);
    langDet = { language: "en", confidence: 0.3 };
  }
  const preferred =
    (contact.preferredLanguage as SupportedLanguage) || "en";
  const convLang = resolveConversationLanguage(langDet, preferred);
  console.log(`${TAG} ⑥ conversation language resolved: ${convLang}`);
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

  async function deliverOutbound(
    text: string,
    opts?: { skipNaturalize?: boolean },
  ) {
    outboundThisTurn = true;
    let out = text;
    if (
      input.channel === "whatsapp" &&
      whatsappConversationFeaturesEnabled() &&
      !opts?.skipNaturalize
    ) {
      console.log(`${TAG} ⑦ naturalizing reply (OpenAI)…`);
      try {
        const n = await naturalizeWhatsappReply({
          scriptedIntent: text,
          userMessage: input.body,
          transcript: await loadTranscript(),
          language: convLang,
          reservationSummary: reservationBlurb(),
          passengerName: reservation.customerName,
        });
        if (n) {
          out = n;
          console.log(`${TAG} ⑦ reply naturalized`);
        }
      } catch (e) {
        console.warn(`${TAG} ✗ naturalizeWhatsappReply failed — sending scripted text:`, e);
      }
    }
    console.log(`${TAG} ⑦ sending outbound via ${input.channel}, excerpt: "${out.slice(0, 80)}"`);
    await sendReply(caseRow, reservation, contact, out, input.channel);
  }

  console.log(`${TAG} ⑥ entering state branch: "${caseRow.orchestrationState}" (aiConversation=${whatsappConversationFeaturesEnabled()}, openaiKey=${Boolean(process.env.OPENAI_API_KEY)})`);

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
        });
      } catch (e) {
        console.warn("[processInboundMessaging] generateInboundAssistantReply failed:", e);
      }
      const reply = aiText ?? cannedNeedsHumanAck(convLang);
      await deliverOutbound(reply, { skipNaturalize: true });
    }
    return { ok: true };
  }

  let state = caseRow.orchestrationState as OrchestrationState;

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
    );
    return { ok: true };
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
    const text =
      convLang === "pt"
        ? "Podemos enviar lembretes úteis sobre o seu transfer por WhatsApp ou SMS no futuro? Responda SIM ou NÃO."
        : convLang === "es"
          ? "¿Podemos enviarle recordatorios útiles por WhatsApp o SMS en el futuro? Responda SÍ o NO."
          : convLang === "fr"
            ? "Pouvons-nous envoyer des rappels utiles par WhatsApp ou SMS ? Répondez OUI ou NON."
            : convLang === "de"
              ? "Dürfen wir später hilfreiche Erinnerungen per WhatsApp oder SMS senden? Antworten Sie JA oder NEIN."
              : "May we send helpful reminders by WhatsApp or SMS in the future? Reply YES or NO.";
    await deliverOutbound(text);
    return { ok: true };
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
        if (input.channel === "whatsapp") {
          await deliverOutbound(cannedCrmHandoffAfterSyncFail(convLang), {
            skipNaturalize: true,
          });
        }
        return { ok: true };
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
      const ack =
        convLang === "pt"
          ? "Obrigado. Vamos confirmar consigo no dia anterior à viagem."
          : "Thank you. We will confirm with you the day before travel.";
      await deliverOutbound(ack);
      return { ok: true };
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
    const fix =
      convLang === "pt"
        ? "O que devemos corrigir? Responda com os detalhes."
        : "What should we correct? Reply with the details.";
    await deliverOutbound(fix);
    return { ok: true };
  }

  if (state === "commercial_eligible") {
    await sendCommercialIfEligible(
      caseRow,
      reservation,
      contact,
      convLang,
      deliverOutbound,
    );
    return { ok: true };
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

    const collected = (caseRow.collectedData ?? {}) as CollectedDataJson;
    let extraction: Awaited<ReturnType<typeof extractOperationalFields>>;
    try {
      extraction = await extractOperationalFields({
        customerMessage: input.body,
        prior: collected as Record<string, unknown>,
      });
    } catch (e) {
      console.warn("[processInboundMessaging] extractOperationalFields failed:", e);
      extraction = { confidence: {} };
    }
    const merged = mergeExtraction(
      collected as Record<string, unknown>,
      extraction,
    ) as unknown as CollectedDataJson;
    const confVals = extraction.confidence
      ? Object.values(extraction.confidence)
      : [];
    const lowConf = confVals.some((c) => c < 0.5);
    if (lowConf) {
      await writeBehaviouralEvent({
        eventType: "extraction_low_confidence",
        caseId: caseRow.id,
        reservationId: reservation.id,
      });
    }

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
      const scripted = promptForField(missing, convLang);
      let replyBody = scripted;
      let skipNat = false;
      if (
        input.channel === "whatsapp" &&
        whatsappConversationFeaturesEnabled() &&
        process.env.OPENAI_API_KEY
      ) {
        try {
          const aiAsk = await generateWhatsappEnrichmentAsk({
            fieldKey: missing,
            scriptedQuestion: scripted,
            userMessage: input.body,
            transcript: await loadTranscript(),
            language: convLang,
            reservationSummary: reservationBlurb(),
            passengerName: reservation.customerName,
          });
          if (aiAsk) {
            replyBody = aiAsk;
            skipNat = true;
          }
        } catch (e) {
          console.warn("[processInboundMessaging] generateWhatsappEnrichmentAsk failed:", e);
        }
      }
      await deliverOutbound(replyBody, { skipNaturalize: skipNat });
      return { ok: true };
    }

    assertTransition("collect_missing", "summarize_confirm");
    const summary = formatSummary(merged, convLang);
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
    await deliverOutbound(summary);
    return { ok: true };
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
    input.channel === "whatsapp" &&
    !outboundThisTurn &&
    orchestrationNow !== "closed" &&
    orchestrationNow !== "cancelled"
  ) {
    let msg: string;
    const useAiCatchAll =
      whatsappConversationFeaturesEnabled() && Boolean(process.env.OPENAI_API_KEY);
    if (useAiCatchAll) {
      try {
        msg =
          (await generateWhatsappCatchAllReply({
            userMessage: input.body,
            language: convLang,
            orchestrationState: orchestrationNow,
            transcript: await loadTranscript(),
            reservationSummary: reservationBlurb(),
            bookingRef: reservation.externalBookingId,
            passengerName: reservation.customerName,
          })) ?? cannedWhatsappCatchAllReply(convLang);
      } catch (e) {
        console.warn("[processInboundMessaging] generateWhatsappCatchAllReply failed:", e);
        msg = cannedWhatsappCatchAllReply(convLang);
      }
    } else {
      msg = cannedWhatsappCatchAllReply(convLang);
    }
    await deliverOutbound(msg, { skipNaturalize: true });
  }

  if (input.channel === "whatsapp" && !outboundThisTurn) {
    const snap = await sb
      .from("cases")
      .select("orchestration_state, case_status")
      .eq("id", caseRow.id)
      .maybeSingle();
    console.info("[processInboundMessaging] whatsapp inbound finished with no outbound", {
      caseId: caseRow.id,
      orchestrationState: snap.data?.orchestration_state,
      caseStatus: snap.data?.case_status,
      excerpt: input.body.slice(0, 80),
    });
  }

  return { ok: true };
}

async function sendCommercialIfEligible(
  caseRow: CaseRow,
  reservation: ReservationRow,
  contact: ContactRow,
  convLang: SupportedLanguage,
  deliver: (text: string, opts?: { skipNaturalize?: boolean }) => Promise<void>,
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
    const text =
      convLang === "pt"
        ? "Quer que reservemos também o transfer de regresso?"
        : "Would you like us to arrange your return transfer as well?";
    await deliver(text);
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
) {
  const TAG = "[pipeline]";
  const to = contact.phone ?? reservation.sourcePhone;
  if (!to) {
    console.warn(`${TAG} ✗ sendReply skipped — no phone on contact or reservation`);
    return;
  }
  const toE164 = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
  console.log(`${TAG} ⑦ calling Meta/Infobip send → ${toE164} via ${preferredChannel}`);
  const send = await sendViaPreferredChannel({
    caseId: caseRow.id,
    reservationId: reservation.id,
    preferred: preferredChannel,
    toE164,
    body: text,
  });
  if (!send.ok) {
    console.warn(`${TAG} ✗ outbound send FAILED`, {
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
    return;
  }
  console.log(`${TAG} ⑧ outbound sent OK via ${send.channel}, msgId=${send.providerMessageId}`);
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
  console.log(`${TAG} ⑧ outbound message row saved to DB`);
}

function formatSummary(data: CollectedDataJson, lang: SupportedLanguage): string {
  const lines = [
    lang === "pt" ? "Resumo:" : "Summary:",
    `${lang === "pt" ? "Passageiros" : "Passengers"}: ${data.passenger_count_actual ?? "—"}`,
    `${lang === "pt" ? "Crianças" : "Children"}: ${data.children_count ?? "—"}`,
    `${lang === "pt" ? "Bagagem especial" : "Special luggage"}: ${data.special_luggage_present ?? "—"}`,
    `${lang === "pt" ? "Mobilidade" : "Mobility"}: ${data.reduced_mobility_present ?? "—"}`,
    `${lang === "pt" ? "Notas" : "Notes"}: ${data.additional_notes ?? "—"}`,
    lang === "pt"
      ? "Está tudo correto? Responda SIM ou NÃO."
      : "Is this correct? Reply YES or NO.",
  ];
  return lines.join("\n");
}
