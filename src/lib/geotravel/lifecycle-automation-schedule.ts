import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  hoursUntilSatisfactionDue,
  satisfactionDelayHours,
} from "@/lib/geotravel/satisfaction-timing";
import {
  HOURS_BEFORE_DATA,
  HOURS_BEFORE_WELCOME_2,
  hoursUntilPickup,
  isBookingCancelledForWhatsapp,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";

export { satisfactionDelayHours } from "@/lib/geotravel/satisfaction-timing";

export function hasWelcomeLifecycleSent(
  sentPhases: ReadonlySet<GeotravelWhatsappLifecycleTemplate>,
): boolean {
  return sentPhases.has("welcome_1") || sentPhases.has("welcome_2");
}

/**
 * Next lifecycle template to send on this automation tick (at most one per run).
 *
 * Sequence:
 * 1. canceled — as soon as the booking is cancelled (once)
 * 2. welcome_1 — pickup more than 72h away (once)
 * 3. welcome_2 — pickup between 48h and 72h, or late sync within 48h before welcome (once)
 * 4. data — within 48h before pickup, after a welcome was sent (once)
 * 5. satisfaction — after dropoff (+ delay) when dropoff is known, else one month after pickup (once)
 */
export function nextLifecyclePhaseToSend(
  booking: GeotravelBooking,
  sentPhases: ReadonlySet<GeotravelWhatsappLifecycleTemplate>,
  nowMs: number = Date.now(),
): GeotravelWhatsappLifecycleTemplate | null {
  const hoursUntilPu = hoursUntilPickup(booking, nowMs);
  const hoursUntilSat = hoursUntilSatisfactionDue(booking, nowMs);

  if (isBookingCancelledForWhatsapp(booking)) {
    return sentPhases.has("canceled") ? null : "canceled";
  }

  if (hoursUntilSat !== null && hoursUntilSat <= 0) {
    return sentPhases.has("satisfaction") ? null : "satisfaction";
  }

  const welcomeSent = hasWelcomeLifecycleSent(sentPhases);

  const hours = hoursUntilPu;

  if (
    hours !== null &&
    hours > 0 &&
    hours <= HOURS_BEFORE_DATA &&
    welcomeSent &&
    !sentPhases.has("data")
  ) {
    return "data";
  }

  if (!welcomeSent) {
    if (hours === null || hours > HOURS_BEFORE_WELCOME_2) {
      if (!sentPhases.has("welcome_1")) return "welcome_1";
    }
    if (
      hours !== null &&
      hours > HOURS_BEFORE_DATA &&
      hours <= HOURS_BEFORE_WELCOME_2 &&
      !sentPhases.has("welcome_2")
    ) {
      return "welcome_2";
    }
    if (
      hours !== null &&
      hours > 0 &&
      hours <= HOURS_BEFORE_DATA &&
      !sentPhases.has("welcome_2")
    ) {
      return "welcome_2";
    }
  }

  return null;
}

/** @deprecated Use nextLifecyclePhaseToSend with sent phases */
export function lifecyclePhaseForFirstAutomatedSend(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): GeotravelWhatsappLifecycleTemplate | null {
  return nextLifecyclePhaseToSend(booking, new Set(), nowMs);
}
