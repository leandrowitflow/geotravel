import { takeRows } from "@/db/supabase-helpers";
import type { CollectedDataJson } from "@/db/schema";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  isGeotravelWhatsappLifecycleTemplate,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";
import { parseStoredOutboundTemplatePhase } from "@/lib/geotravel/whatsapp-template-ai-context";
import { serviceSupabase } from "@/lib/supabase/service-role";

const EXTERNAL_SOURCE = "geotravel_data_api";

function externalBookingId(booking: GeotravelBooking): string {
  return booking.booking_reference?.trim() || String(booking.id);
}

export type BookingCaseLifecycleState = {
  caseId: string | null;
  collectedData: CollectedDataJson | null;
  outboundWhatsappCount: number;
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
      outboundWhatsappCount: 0,
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
      outboundWhatsappCount: 0,
      lifecyclePhases,
    };
  }

  const messages = takeRows<{
    body: string;
    metadata: Record<string, unknown> | null;
  }>(
    "outbound whatsapp messages for lifecycle",
    await sb
      .from("messages")
      .select("body,metadata")
      .eq("case_id", caseRow.id)
      .eq("direction", "outbound")
      .eq("channel", "whatsapp")
      .order("created_at", { ascending: true }),
  );

  for (const m of messages) {
    const meta = m.metadata?.lifecycle_phase;
    if (
      typeof meta === "string" &&
      isGeotravelWhatsappLifecycleTemplate(meta)
    ) {
      lifecyclePhases.add(meta);
      continue;
    }
    const parsed = parseStoredOutboundTemplatePhase(m.body);
    if (
      parsed &&
      parsed !== "unknown" &&
      isGeotravelWhatsappLifecycleTemplate(parsed)
    ) {
      lifecyclePhases.add(parsed);
    }
  }

  const collected = (caseRow.collected_data as CollectedDataJson) ?? null;

  return {
    caseId: caseRow.id,
    collectedData: collected,
    outboundWhatsappCount: messages.length,
    lifecyclePhases,
  };
}

/** Lifecycle template phases already sent on WhatsApp for this booking. */
export async function getSentLifecyclePhasesForBooking(
  booking: GeotravelBooking,
): Promise<Set<GeotravelWhatsappLifecycleTemplate>> {
  const state = await loadBookingCaseLifecycleState(booking);
  return state.lifecyclePhases;
}

/**
 * Inngest automation: one WhatsApp per case — skip if we already sent anything on this case.
 */
export async function bookingCaseAlreadyHadWhatsappSend(
  booking: GeotravelBooking,
): Promise<{ skip: boolean; reason?: string }> {
  const state = await loadBookingCaseLifecycleState(booking);

  if (state.collectedData?.lifecycle_automation_sent_at) {
    return { skip: true, reason: "lifecycle_automation_already_recorded" };
  }

  if (state.outboundWhatsappCount > 0) {
    return { skip: true, reason: "case_already_has_outbound_whatsapp" };
  }

  if (state.lifecyclePhases.size > 0) {
    return { skip: true, reason: "lifecycle_template_already_sent" };
  }

  return { skip: false };
}
