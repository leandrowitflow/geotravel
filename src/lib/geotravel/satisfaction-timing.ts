import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";

const MS_PER_HOUR = 60 * 60 * 1000;

/** Hours after dropoff before sending satisfaction when dropoff is known (default 24h). */
export function satisfactionDelayHours(): number {
  const raw = process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS?.trim();
  const n = raw ? Number(raw) : 24;
  return Number.isFinite(n) && n >= 0 ? n : 24;
}

function pickupMs(booking: GeotravelBooking): number | null {
  const raw = booking.pickup_date_time?.trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

function explicitDropoffMs(booking: GeotravelBooking): number | null {
  const raw = booking.dropoff_date_time?.trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** Calendar months after pickup when the API has no dropoff time (default 1). */
export function satisfactionMonthsAfterPickupFallback(): number {
  const raw =
    process.env.GEOTRAVEL_SATISFACTION_MONTHS_AFTER_PICKUP?.trim();
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function addCalendarMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/**
 * When satisfaction automation should fire.
 * - With dropoff_date_time: dropoff + GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS (default 24h).
 * - Without dropoff: pickup + GEOTRAVEL_SATISFACTION_MONTHS_AFTER_PICKUP calendar months (default 1).
 */
export function resolveSatisfactionDueMs(booking: GeotravelBooking): number | null {
  const dropoff = explicitDropoffMs(booking);
  if (dropoff !== null) {
    return dropoff + satisfactionDelayHours() * MS_PER_HOUR;
  }

  const pickup = pickupMs(booking);
  if (pickup === null) return null;

  return addCalendarMonths(
    pickup,
    satisfactionMonthsAfterPickupFallback(),
  );
}

/** Hours until satisfaction is due; zero or negative means send now. */
export function hoursUntilSatisfactionDue(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): number | null {
  const dueMs = resolveSatisfactionDueMs(booking);
  if (dueMs === null) return null;
  return (dueMs - nowMs) / MS_PER_HOUR;
}

export function isSatisfactionDue(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): boolean {
  const hours = hoursUntilSatisfactionDue(booking, nowMs);
  return hours !== null && hours <= 0;
}
