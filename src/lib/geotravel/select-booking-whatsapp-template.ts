import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";

/** Meta template names (all use language `en` on our WABA). */
export const GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES = [
  "welcome_1",
  "welcome_2",
  "data",
  "canceled",
  "satisfaction",
] as const;

export type GeotravelWhatsappLifecycleTemplate =
  (typeof GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES)[number];

export type GeotravelWhatsappTemplatePhase =
  | "welcome_1"
  | "welcome_2"
  | "data"
  | "canceled"
  | "satisfaction";

export const GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE = "en" as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const HOURS_BEFORE_WELCOME_2 = 72;
const HOURS_BEFORE_DATA = 24;

export function isGeotravelWhatsappLifecycleTemplate(
  name: string,
): name is GeotravelWhatsappLifecycleTemplate {
  return (GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES as readonly string[]).includes(
    name,
  );
}

export function isBookingCancelledForWhatsapp(booking: GeotravelBooking): boolean {
  const outcome = (booking.outcome ?? "").trim().toLowerCase();
  const status = (booking.status ?? "").trim().toLowerCase();
  return outcome.includes("cancel") || status.includes("cancel");
}

/** Hours until pickup; negative after pickup time. */
export function hoursUntilPickup(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): number | null {
  const raw = booking.pickup_date_time?.trim();
  if (!raw) return null;
  const pickupMs = Date.parse(raw);
  if (Number.isNaN(pickupMs)) return null;
  return (pickupMs - nowMs) / MS_PER_HOUR;
}

export type SelectedBookingWhatsappTemplate = {
  phase: GeotravelWhatsappTemplatePhase;
  templateName: GeotravelWhatsappLifecycleTemplate;
  language: typeof GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE;
  hoursUntilPickup: number | null;
  /** Short label for admin UI */
  reason: string;
};

/**
 * Pick Meta template for manual admin “WhatsApp” sends (pilot numbers only).
 *
 * - canceled — booking cancelled
 * - satisfaction — pickup time has passed
 * - data — within 24h of pickup (still in the future)
 * - welcome_2 — less than 72h until pickup (but more than 24h)
 * - welcome_1 — more than 72h until pickup (or unknown pickup time)
 */
export function selectBookingWhatsappTemplate(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): SelectedBookingWhatsappTemplate {
  const hours = hoursUntilPickup(booking, nowMs);

  if (isBookingCancelledForWhatsapp(booking)) {
    return {
      phase: "canceled",
      templateName: "canceled",
      language: GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE,
      hoursUntilPickup: hours,
      reason: "Booking is cancelled",
    };
  }

  if (hours !== null && hours < 0) {
    return {
      phase: "satisfaction",
      templateName: "satisfaction",
      language: GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE,
      hoursUntilPickup: hours,
      reason: "Pickup time has passed",
    };
  }

  if (hours !== null && hours <= HOURS_BEFORE_DATA) {
    return {
      phase: "data",
      templateName: "data",
      language: GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE,
      hoursUntilPickup: hours,
      reason: `Within ${HOURS_BEFORE_DATA}h of pickup`,
    };
  }

  if (hours !== null && hours < HOURS_BEFORE_WELCOME_2) {
    return {
      phase: "welcome_2",
      templateName: "welcome_2",
      language: GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE,
      hoursUntilPickup: hours,
      reason: `Less than ${HOURS_BEFORE_WELCOME_2}h until pickup`,
    };
  }

  return {
    phase: "welcome_1",
    templateName: "welcome_1",
    language: GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE,
    hoursUntilPickup: hours,
    reason:
      hours === null
        ? "No pickup time — default welcome_1"
        : `More than ${HOURS_BEFORE_WELCOME_2}h until pickup`,
  };
}

export function formatHoursUntilPickup(hours: number | null): string {
  if (hours === null) return "pickup time unknown";
  if (hours < 0) return `${Math.abs(Math.round(hours))}h ago`;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.round(hours)}h`;
}
