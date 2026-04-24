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
  extractOperationalFields,
  mergeExtraction,
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
import { assertTransition, type OrchestrationState } from "./state-machine";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return raw;
  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export async function processInboundMessaging(input: {
  channel: "whatsapp" | "sms";
  fromE164: string;
  body: string;
  providerMessageId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = serviceSupabase();
  const phone = normalizePhone(input.fromE164);
  const contactRows = takeRows<Record<string, unknown>>(
    "contact by phone",
    await sb
      .from("contacts")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const contactRaw = contactRows[0];
  if (!contactRaw) {
    return { ok: false, error: "unknown_contact" };
  }
  const contact = mapContact(contactRaw);

  const resRes = await sb
    .from("reservations")
    .select("*")
    .eq("id", contact.reservationId)
    .maybeSingle();
  if (resRes.error) {
    return { ok: false, error: resRes.error.message };
  }
  if (!resRes.data) {
    return { ok: false, error: "reservation_not_found" };
  }
  const reservation = mapReservation(resRes.data as Record<string, unknown>);

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
    return { ok: false, error: "case_not_found" };
  }
  const caseRow = mapCase(caseRowRaw);

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

  if (
    caseRow.caseStatus === "closed" ||
    caseRow.orchestrationState === "cancelled"
  ) {
    return { ok: true };
  }
  if (caseRow.orchestrationState === "needs_human") {
    return { ok: true };
  }

  const langDet = await detectLanguageFromText(input.body);
  const preferred =
    (contact.preferredLanguage as SupportedLanguage) || "en";
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
    await sendReply(caseRow, reservation, contact, text);
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
      await sendReply(caseRow, reservation, contact, ack);
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
    await sendReply(caseRow, reservation, contact, fix);
    return { ok: true };
  }

  if (state === "commercial_eligible") {
    await sendCommercialIfEligible(caseRow, reservation, contact, convLang);
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
    const extraction = await extractOperationalFields({
      customerMessage: input.body,
      prior: collected as Record<string, unknown>,
    });
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
      const q = promptForField(missing, convLang);
      await sendReply(caseRow, reservation, contact, q);
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
    await sendReply(caseRow, reservation, contact, summary);
    return { ok: true };
  }

  return { ok: true };
}

async function sendCommercialIfEligible(
  caseRow: CaseRow,
  reservation: ReservationRow,
  contact: ContactRow,
  convLang: SupportedLanguage,
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
    await sendReply(caseRow, reservation, contact, text);
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
) {
  const to = contact.phone ?? reservation.sourcePhone;
  if (!to) return;
  const send = await sendViaPreferredChannel({
    caseId: caseRow.id,
    reservationId: reservation.id,
    preferred: caseRow.currentChannel as "whatsapp" | "sms",
    toE164: to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`,
    body: text,
  });
  if (send.ok) {
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
  }
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
