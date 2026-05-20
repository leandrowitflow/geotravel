import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { fetchGeotravelBookingsPhoneScan } from "@/lib/geotravel/bookings-api";
import { executeGeotravelWelcomeSend } from "@/lib/geotravel/execute-geotravel-welcome-send";
import {
  bookingMatchesLifecycleInngestPilot,
  lifecycleWhatsappAutomationEnabled,
  LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS,
} from "@/lib/geotravel/lifecycle-inngest-pilot";
import { bookingCaseAlreadyHadWhatsappSend } from "@/lib/geotravel/lifecycle-whatsapp-sent-phases";
import {
  hoursUntilPickup,
  selectBookingWhatsappTemplate,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";

const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

/** Hours after pickup before sending satisfaction (client has left). */
function satisfactionDelayHours(): number {
  const raw = process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS?.trim();
  const n = raw ? Number(raw) : 2;
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

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

/**
 * Phase to send on the case's first (and only) automated lifecycle message.
 */
export function lifecyclePhaseForFirstAutomatedSend(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): GeotravelWhatsappLifecycleTemplate | null {
  const selection = selectBookingWhatsappTemplate(booking, nowMs);
  const phase = selection.phase;

  const hours = hoursUntilPickup(booking, nowMs);
  if (phase === "satisfaction") {
    const delay = satisfactionDelayHours();
    if (hours === null || hours > -delay) {
      return null;
    }
  }

  if (
    (phase === "welcome_1" ||
      phase === "welcome_2" ||
      phase === "data") &&
    hours !== null &&
    hours <= 0
  ) {
    return null;
  }

  return phase;
}

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
 * Inngest cron: send lifecycle WhatsApp templates for pilot phone 966915976 only.
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
    const currentPhase = selectBookingWhatsappTemplate(booking, nowMs).phase;

    const already = await bookingCaseAlreadyHadWhatsappSend(booking);
    if (already.skip) {
      attempts.push({
        bookingId: booking.id,
        bookingRef: ref,
        phase: currentPhase,
        ok: true,
        skipped: already.reason ?? "case_already_sent",
      });
      continue;
    }

    const phase = lifecyclePhaseForFirstAutomatedSend(booking, nowMs);
    if (!phase) {
      attempts.push({
        bookingId: booking.id,
        bookingRef: ref,
        phase: currentPhase,
        ok: true,
        skipped: "not_due_yet",
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
