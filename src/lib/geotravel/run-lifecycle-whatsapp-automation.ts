import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { fetchGeotravelBookingsPhoneScan } from "@/lib/geotravel/bookings-api";
import { executeGeotravelWelcomeSend } from "@/lib/geotravel/execute-geotravel-welcome-send";
import {
  bookingMatchesLifecycleInngestPilot,
  lifecycleWhatsappAutomationEnabled,
  LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS,
} from "@/lib/geotravel/lifecycle-inngest-pilot";
import { getSentLifecyclePhasesForBooking } from "@/lib/geotravel/lifecycle-whatsapp-sent-phases";
import { nextLifecyclePhaseToSend } from "@/lib/geotravel/lifecycle-automation-schedule";
import {
  selectBookingWhatsappTemplate,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";

export { nextLifecyclePhaseToSend, satisfactionDelayHours } from "@/lib/geotravel/lifecycle-automation-schedule";
/** @deprecated Use nextLifecyclePhaseToSend */
export { lifecyclePhaseForFirstAutomatedSend } from "@/lib/geotravel/lifecycle-automation-schedule";

const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

export type LifecycleWhatsappSendAttempt = {
  bookingId: number;
  bookingRef: string | null;
  phase: GeotravelWhatsappLifecycleTemplate;
  ok: boolean;
  error?: string;
  skipped?: string;
};

export type RunLifecycleWhatsappAutomationResult =
  | { ok: true; skipped: true; reason: string }
  | {
      ok: true;
      skipped: false;
      bookingsScanned: number;
      attempts: LifecycleWhatsappSendAttempt[];
    }
  | { ok: false; error: string };

async function fetchAllPilotBookings(): Promise<
  { ok: true; bookings: GeotravelBooking[] } | { ok: false; error: string }
> {
  if (!process.env.GEOTRAVEL_API_KEY?.trim()) {
    return { ok: false, error: "GEOTRAVEL_API_KEY not set" };
  }

  const bookings: GeotravelBooking[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchGeotravelBookingsPhoneScan({
      phoneDigits: LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS,
      passengerPhoneParam: LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS,
      page,
      limit: PAGE_LIMIT,
    });
    if (!res.ok) return { ok: false, error: res.error };
    bookings.push(...res.data);
    if (res.data.length < PAGE_LIMIT) break;
  }

  return { ok: true, bookings };
}

/**
 * Inngest cron: send lifecycle templates for pilot phone only.
 * Multiple templates per case over time (welcome → data → satisfaction, or canceled).
 */
export async function runLifecycleWhatsappAutomation(): Promise<RunLifecycleWhatsappAutomationResult> {
  if (!lifecycleWhatsappAutomationEnabled()) {
    return { ok: true, skipped: true, reason: "automation_disabled" };
  }

  const fetch = await fetchAllPilotBookings();
  if (!fetch.ok) return { ok: false, error: fetch.error };

  const pilotBookings = fetch.bookings.filter((b) =>
    bookingMatchesLifecycleInngestPilot(b.passenger_phone),
  );

  const attempts: LifecycleWhatsappSendAttempt[] = [];
  const nowMs = Date.now();

  for (const booking of pilotBookings) {
    const ref = booking.booking_reference?.trim() ?? null;
    const windowPhase = selectBookingWhatsappTemplate(booking, nowMs).phase;
    const sentPhases = await getSentLifecyclePhasesForBooking(booking);
    const phase = nextLifecyclePhaseToSend(booking, sentPhases, nowMs);

    if (!phase) {
      attempts.push({
        bookingId: booking.id,
        bookingRef: ref,
        phase: windowPhase,
        ok: true,
        skipped: "not_due_or_already_sent",
      });
      continue;
    }

    const result = await executeGeotravelWelcomeSend(booking, {
      useLifecycleTemplates: true,
      templateOverride: phase,
      fromLifecycleAutomation: true,
    });

    if (result.ok) {
      attempts.push({
        bookingId: booking.id,
        bookingRef: ref,
        phase,
        ok: true,
      });
    } else {
      attempts.push({
        bookingId: booking.id,
        bookingRef: ref,
        phase,
        ok: false,
        error:
          typeof result.body.error === "string"
            ? result.body.error
            : JSON.stringify(result.body),
      });
    }
  }

  return {
    ok: true,
    skipped: false,
    bookingsScanned: pilotBookings.length,
    attempts,
  };
}
