import { takeRows } from "@/db/supabase-helpers";
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

/** Lifecycle template phases already sent on WhatsApp for this booking. */
export async function getSentLifecyclePhasesForBooking(
  booking: GeotravelBooking,
): Promise<Set<GeotravelWhatsappLifecycleTemplate>> {
  const extId = externalBookingId(booking);
  const sb = serviceSupabase();
  const sent = new Set<GeotravelWhatsappLifecycleTemplate>();

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
  if (!reservationPk) return sent;

  const caseRows = takeRows<{ id: string }>(
    "case for lifecycle sent check",
    await sb
      .from("cases")
      .select("id")
      .eq("reservation_id", reservationPk)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const caseId = caseRows[0]?.id;
  if (!caseId) return sent;

  const messages = takeRows<{
    body: string;
    metadata: Record<string, unknown> | null;
  }>(
    "outbound whatsapp messages for lifecycle",
    await sb
      .from("messages")
      .select("body,metadata")
      .eq("case_id", caseId)
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
      sent.add(meta);
      continue;
    }
    const parsed = parseStoredOutboundTemplatePhase(m.body);
    if (parsed && parsed !== "unknown" && isGeotravelWhatsappLifecycleTemplate(parsed)) {
      sent.add(parsed);
    }
  }

  return sent;
}
