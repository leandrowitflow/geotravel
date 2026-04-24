import { mapCase } from "@/db/map-supabase";
import { assertNoError, takeRows } from "@/db/supabase-helpers";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import { serviceSupabase } from "@/lib/supabase/service-role";
import {
  defaultRetryDelayMinutes,
  isQuietHourNow,
  maxOutboundAttempts,
} from "@/lib/scheduling/quiet-hours";
import { assertTransition, type OrchestrationState } from "./state-machine";

function normalizeToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function nowOrLteFilter(): string {
  return `next_retry_at.is.null,next_retry_at.lte."${new Date().toISOString()}"`;
}

export async function processOutreachQueue(): Promise<{ processed: number }> {
  const sb = serviceSupabase();
  if (isQuietHourNow()) {
    return { processed: 0 };
  }
  const pendingRaw = takeRows<Record<string, unknown>>(
    "outreach pending cases",
    await sb
      .from("cases")
      .select("*")
      .eq("orchestration_state", "awaiting_outreach")
      .eq("case_status", "active")
      .or(nowOrLteFilter())
      .limit(25),
  );
  const pending = pendingRaw.map(mapCase);

  let processed = 0;
  for (const c of pending) {
    if (c.attemptCount >= c.maxAttempts) {
      assertNoError(
        "case max attempts",
        await sb
          .from("cases")
          .update({
            orchestration_state: "needs_human",
            exception_flag: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id),
      );
      continue;
    }
    const resvRows = takeRows<Record<string, unknown>>(
      "reservation for outreach",
      await sb.from("reservations").select("*").eq("id", c.reservationId).limit(1),
    );
    const rRaw = resvRows[0];
    if (!rRaw) continue;
    const r = {
      id: String(rRaw.id),
      customerName: (rRaw.customer_name as string) ?? null,
      externalBookingId: String(rRaw.external_booking_id),
      sourcePhone: (rRaw.source_phone as string) ?? null,
    };
    const contRows = takeRows<Record<string, unknown>>(
      "contact for outreach",
      await sb
        .from("contacts")
        .select("*")
        .eq("reservation_id", r.id)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const contact = contRows[0];
    const to = normalizeToE164(
      (contact?.phone as string) ?? r.sourcePhone,
    );
    if (!to) {
      assertNoError(
        "case no phone",
        await sb
          .from("cases")
          .update({
            orchestration_state: "needs_human",
            exception_flag: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id),
      );
      continue;
    }
    const name = r.customerName ?? "there";
    const body = `Hi ${name}, this is Geotravel about your upcoming transfer (booking ${r.externalBookingId}). Is this the best number to reach you? Reply YES to confirm.`;
    const send = await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    if (send.ok) {
      assertNoError(
        "outreach message",
        await sb.from("messages").insert({
          case_id: c.id,
          direction: "outbound",
          channel: send.channel,
          body,
          provider_message_id: send.providerMessageId,
          status: "sent",
        }),
      );
    }
    assertTransition(
      c.orchestrationState as OrchestrationState,
      "identity_confirm",
    );
    assertNoError(
      "case after outreach",
      await sb
        .from("cases")
        .update({
          orchestration_state: "identity_confirm",
          attempt_count: c.attemptCount + 1,
          next_retry_at: new Date(
            Date.now() + defaultRetryDelayMinutes() * 60 * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id),
    );
    processed += 1;
  }
  return { processed };
}

export async function processD1Confirmations(): Promise<{ processed: number }> {
  const sb = serviceSupabase();
  if (isQuietHourNow()) {
    return { processed: 0 };
  }
  const now = new Date().toISOString();
  const dueRaw = takeRows<Record<string, unknown>>(
    "d1 due cases",
    await sb
      .from("cases")
      .select("*")
      .eq("orchestration_state", "awaiting_d1")
      .lte("d1_scheduled_for", now)
      .eq("case_status", "active")
      .limit(25),
  );
  const due = dueRaw.map(mapCase);

  let processed = 0;
  for (const c of due) {
    assertTransition(
      c.orchestrationState as OrchestrationState,
      "d1_confirm",
    );
    const resvRows = takeRows<Record<string, unknown>>(
      "reservation for d1",
      await sb.from("reservations").select("*").eq("id", c.reservationId).limit(1),
    );
    const rRaw = resvRows[0];
    if (!rRaw) continue;
    const r = {
      id: String(rRaw.id),
      pickupLocation: (rRaw.pickup_location as string) ?? null,
      dropoffLocation: (rRaw.dropoff_location as string) ?? null,
      externalBookingId: String(rRaw.external_booking_id),
      sourcePhone: (rRaw.source_phone as string) ?? null,
    };
    const contRows = takeRows<Record<string, unknown>>(
      "contact for d1",
      await sb
        .from("contacts")
        .select("*")
        .eq("reservation_id", r.id)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const contact = contRows[0];
    const to = normalizeToE164(
      (contact?.phone as string) ?? r.sourcePhone,
    );
    if (!to) continue;
    const lang = ((contact?.preferred_language as string) ?? "en").slice(0, 2) as
      | "en"
      | "pt"
      | "es"
      | "fr"
      | "de";
    const body =
      lang === "pt"
        ? `Olá! Confirma o seu transfer amanhã de ${r.pickupLocation ?? "?"} para ${r.dropoffLocation ?? "?"}? Responda SIM ou NÃO.`
        : `Hello! Please confirm your transfer tomorrow from ${r.pickupLocation ?? "?"} to ${r.dropoffLocation ?? "?"}? Reply YES or NO.`;
    const send = await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    if (send.ok) {
      assertNoError(
        "d1 message",
        await sb.from("messages").insert({
          case_id: c.id,
          direction: "outbound",
          channel: send.channel,
          body,
          provider_message_id: send.providerMessageId,
          status: "sent",
        }),
      );
    }
    assertNoError(
      "case d1_confirm state",
      await sb
        .from("cases")
        .update({
          orchestration_state: "d1_confirm",
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id),
    );
    await writeBehaviouralEvent({
      eventType: "d1_confirmation_requested",
      caseId: c.id,
      reservationId: r.id,
    });
    processed += 1;
  }
  return { processed };
}

export async function processRetries(): Promise<{ bumped: number }> {
  const sb = serviceSupabase();
  if (isQuietHourNow()) {
    return { bumped: 0 };
  }
  const nowIso = new Date().toISOString();
  const stuckRaw = takeRows<Record<string, unknown>>(
    "retry stuck cases",
    await sb
      .from("cases")
      .select("*")
      .eq("orchestration_state", "identity_confirm")
      .lte("next_retry_at", nowIso)
      .eq("case_status", "active")
      .limit(25),
  );
  const stuck = stuckRaw.map(mapCase);

  let bumped = 0;
  for (const c of stuck) {
    if (c.attemptCount >= maxOutboundAttempts()) {
      assertNoError(
        "case sms fallback",
        await sb
          .from("cases")
          .update({
            current_channel: "sms",
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id),
      );
      await writeBehaviouralEvent({
        eventType: "fallback_sms_triggered",
        caseId: c.id,
        reservationId: c.reservationId,
      });
    }
    const resvRows = takeRows<Record<string, unknown>>(
      "reservation for retry",
      await sb.from("reservations").select("*").eq("id", c.reservationId).limit(1),
    );
    const rRaw = resvRows[0];
    if (!rRaw) continue;
    const r = {
      id: String(rRaw.id),
      externalBookingId: String(rRaw.external_booking_id),
      sourcePhone: (rRaw.source_phone as string) ?? null,
    };
    const contRows = takeRows<Record<string, unknown>>(
      "contact for retry",
      await sb
        .from("contacts")
        .select("*")
        .eq("reservation_id", r.id)
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const contact = contRows[0];
    const to = normalizeToE164(
      (contact?.phone as string) ?? r.sourcePhone,
    );
    if (!to) continue;
    const body = `Reminder: please confirm this number is correct for your Geotravel transfer (ref ${r.externalBookingId}). Reply YES.`;
    await sendViaPreferredChannel({
      caseId: c.id,
      reservationId: r.id,
      preferred: c.currentChannel as "whatsapp" | "sms",
      toE164: to,
      body,
    });
    assertNoError(
      "case after retry",
      await sb
        .from("cases")
        .update({
          attempt_count: c.attemptCount + 1,
          next_retry_at: new Date(
            Date.now() + defaultRetryDelayMinutes() * 60 * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id),
    );
    bumped += 1;
  }
  return { bumped };
}
