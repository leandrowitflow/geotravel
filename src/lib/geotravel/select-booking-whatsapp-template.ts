import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { resolveWhatsappTemplateLanguage } from "@/lib/geotravel/resolve-whatsapp-template-language";
import { normalizeGeotravelPhoneToE164 } from "@/lib/phone/normalize-geotravel-e164";

/** Meta template names (language `en` or `pt_PT` per passenger phone). */
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

export const GEOTRAVEL_WHATSAPP_TEMPLATE_LANGUAGE_EN = "en" as const;

function lifecycleMetaTemplateEnvKey(
  phase: GeotravelWhatsappLifecycleTemplate,
): string {
  return `WHATSAPP_META_TEMPLATE_${phase.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * Meta API template name for a lifecycle phase.
 * Default: same name as the phase (`welcome_1`, `data`, …).
 * Per-phase override: WHATSAPP_META_TEMPLATE_WELCOME_1=other_name
 * Force one template for all phases (dev / missing templates): WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE=booking_confirmation
 */
export function resolveMetaTemplateName(
  phase: GeotravelWhatsappLifecycleTemplate,
): string {
  const specific = process.env[lifecycleMetaTemplateEnvKey(phase)]?.trim();
  if (specific) return specific;
  const forceAll = process.env.WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE?.trim();
  if (forceAll) return forceAll;
  return phase;
}

const MS_PER_HOUR = 60 * 60 * 1000;
/** Second welcome when pickup is within 72h but more than 48h away. */
export const HOURS_BEFORE_WELCOME_2 = 72;
/** Final pre-pickup data template within this many hours of pickup. */
export const HOURS_BEFORE_DATA = 48;

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
  /** Logical lifecycle phase (admin UI / scheduling). */
  phase: GeotravelWhatsappTemplatePhase;
  /** Actual Meta template name on this WABA (see resolveMetaTemplateName). */
  metaTemplateName: string;
  language: string;
  hoursUntilPickup: number | null;
  /** Short label for admin UI */
  reason: string;
};

/**
 * Pick Meta template for manual admin “WhatsApp” sends (pilot numbers only).
 *
 * - canceled — booking cancelled
 * - satisfaction — pickup time has passed
 * - data — within 48h of pickup (still in the future)
 * - welcome_2 — between 48h and 72h until pickup
 * - welcome_1 — more than 72h until pickup (or unknown pickup time)
 */
export function selectBookingWhatsappTemplate(
  booking: GeotravelBooking,
  nowMs: number = Date.now(),
): SelectedBookingWhatsappTemplate {
  const hours = hoursUntilPickup(booking, nowMs);
  const destinationE164 = normalizeGeotravelPhoneToE164(booking.passenger_phone, {
    defaultCountryCode: "351",
  });
  const langCtx = { booking, destinationE164 };

  if (isBookingCancelledForWhatsapp(booking)) {
    const phase = "canceled";
    return {
      phase,
      metaTemplateName: resolveMetaTemplateName(phase),
      language: resolveWhatsappTemplateLanguage(phase, langCtx),
      hoursUntilPickup: hours,
      reason: "Booking is cancelled",
    };
  }

  if (hours !== null && hours < 0) {
    const phase = "satisfaction";
    return {
      phase,
      metaTemplateName: resolveMetaTemplateName(phase),
      language: resolveWhatsappTemplateLanguage(phase, langCtx),
      hoursUntilPickup: hours,
      reason: "Pickup time has passed",
    };
  }

  if (hours !== null && hours > 0 && hours <= HOURS_BEFORE_DATA) {
    const phase = "data";
    return {
      phase,
      metaTemplateName: resolveMetaTemplateName(phase),
      language: resolveWhatsappTemplateLanguage(phase, langCtx),
      hoursUntilPickup: hours,
      reason: `Within ${HOURS_BEFORE_DATA}h of pickup`,
    };
  }

  if (
    hours !== null &&
    hours > HOURS_BEFORE_DATA &&
    hours <= HOURS_BEFORE_WELCOME_2
  ) {
    const phase = "welcome_2";
    return {
      phase,
      metaTemplateName: resolveMetaTemplateName(phase),
      language: resolveWhatsappTemplateLanguage(phase, langCtx),
      hoursUntilPickup: hours,
      reason: `Less than ${HOURS_BEFORE_WELCOME_2}h until pickup`,
    };
  }

  const phase = "welcome_1";
  return {
    phase,
    metaTemplateName: resolveMetaTemplateName(phase),
    language: resolveWhatsappTemplateLanguage(phase, langCtx),
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
