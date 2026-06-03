import { takeRows } from "@/db/supabase-helpers";
import type { CollectedDataJson } from "@/db/schema";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  isGeotravelWhatsappLifecycleTemplate,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";
import { nextLifecyclePhaseToSend } from "@/lib/geotravel/lifecycle-automation-schedule";
import { parseStoredOutboundTemplatePhase } from "@/lib/geotravel/whatsapp-template-ai-context";
import { serviceSupabase } from "@/lib/supabase/service-role";

const EXTERNAL_SOURCE = "geotravel_data_api";

function externalBookingId(booking: GeotravelBooking): string {
  return booking.booking_reference?.trim() || String(booking.id);
}

function addPhaseFromCollectedData(
  lifecyclePhases: Set<GeotravelWhatsappLifecycleTemplate>,
  collected: CollectedDataJson | null,
): void {
  const list = collected?.lifecycle_phases_sent;
  if (Array.isArray(list)) {
    for (const p of list) {
      if (typeof p === "string" && isGeotravelWhatsappLifecycleTemplate(p)) {
        lifecyclePhases.add(p);
      }
    }
  }
  const last = collected?.last_whatsapp_lifecycle_phase?.trim();
  if (last && isGeotravelWhatsappLifecycleTemplate(last)) {
    lifecyclePhases.add(last);
  }
}

export type BookingCaseLifecycleState = {
  caseId: string | null;
  collectedData: CollectedDataJson | null;
  outboundLifecycleMessageCount: number;
  lifecyclePhases: Set<GeotravelWhatsappLifecycleTemplate>;
};

async function loadBookingCaseLifecycleState(
  booking: GeotravelBooking,
): Promise<BookingCaseLifecycleState> {
  const extId = externalBookingId(booking);
  const sb = serviceSupabase();
  const lifecyclePhases = new Set<GeotravelWhatsappLifecycleTemplate>();

  const resRows = takeRows<{ id: string }>(
    "reservation for lifecycle sent check",
    await sb
      .from("reservations")
      .select("id")
      .eq("external_source", EXTERNAL_SOURCE)
      .eq("external_booking_id", extId)
      .limit(1),
  );
  const reservationPk = resRows[0]?.id;
  if (!reservationPk) {
    return {
      caseId: null,
      collectedData: null,
      outboundLifecycleMessageCount: 0,
      lifecyclePhases,
    };
  }

  const caseRows = takeRows<{
    id: string;
    collected_data: CollectedDataJson | null;
  }>(
    "case for lifecycle sent check",
    await sb
      .from("cases")
      .select("id,collected_data")
      .eq("reservation_id", reservationPk)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const caseRow = caseRows[0];
  if (!caseRow?.id) {
    return {
      caseId: null,
      collectedData: null,
      outboundLifecycleMessageCount: 0,
      lifecyclePhases,
    };
  }

  const collected = (caseRow.collected_data as CollectedDataJson) ?? null;
  addPhaseFromCollectedData(lifecyclePhases, collected);

  const messages = takeRows<{
    body: string;
    metadata: Record<string, unknown> | null;
  }>(
    "outbound lifecycle messages",
    await sb
      .from("messages")
      .select("body,metadata")
      .eq("case_id", caseRow.id)
      .eq("direction", "outbound")
      .in("channel", ["whatsapp", "sms"])
      .order("created_at", { ascending: true }),
  );

  let lifecycleMessageCount = 0;
  for (const m of messages) {
    const meta = m.metadata?.lifecycle_phase;
    if (
      typeof meta === "string" &&
      isGeotravelWhatsappLifecycleTemplate(meta)
    ) {
      lifecyclePhases.add(meta);
      lifecycleMessageCount++;
      continue;
    }
    const parsed = parseStoredOutboundTemplatePhase(m.body);
    if (
      parsed &&
      parsed !== "unknown" &&
      isGeotravelWhatsappLifecycleTemplate(parsed)
    ) {
      lifecyclePhases.add(parsed);
      lifecycleMessageCount++;
    }
  }

  return {
    caseId: caseRow.id,
    collectedData: collected,
    outboundLifecycleMessageCount: lifecycleMessageCount,
    lifecyclePhases,
  };
}

/** Lifecycle template phases already sent for this booking (WhatsApp or SMS). */
export async function getSentLifecyclePhasesForBooking(
  booking: GeotravelBooking,
): Promise<Set<GeotravelWhatsappLifecycleTemplate>> {
  const state = await loadBookingCaseLifecycleState(booking);
  return state.lifecyclePhases;
}

/**
 * @deprecated Automation uses getSentLifecyclePhasesForBooking + nextLifecyclePhaseToSend.
 */
export async function bookingCaseAlreadyHadWhatsappSend(
  booking: GeotravelBooking,
): Promise<{ skip: boolean; reason?: string }> {
  const state = await loadBookingCaseLifecycleState(booking);
  const next = nextLifecyclePhaseToSend(booking, state.lifecyclePhases);
  if (next) return { skip: false };
  return { skip: true, reason: "no_lifecycle_phase_due" };
}
