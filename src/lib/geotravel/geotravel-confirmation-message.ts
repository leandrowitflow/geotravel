import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import type { SupportedLanguage } from "@/lib/contracts/extraction";
import { buildInitialOutreachMessage } from "@/lib/orchestration/outreach-first-message";

/** Pilot: admin “WhatsApp confirm” only for rows whose phone digits include this (national PT). */
export const WHATSAPP_PILOT_PHONE_DIGITS = "966915976";

/** Second pilot line (+351 913 535 544): match full international digits or national `913535544`. */
export const WHATSAPP_PILOT_PHONE_DIGITS_351913535544 = "351913535544";
const WHATSAPP_PILOT_NATIONAL_913535544 = "913535544";

/**
 * Digit-only substrings: if `passenger_phone` digits include any of these, the row
 * may show “WhatsApp confirm” (still requires Active + CONFIRMED).
 * Append with `GEOTRAVEL_WHATSAPP_PILOT_PHONE_SUBSTRINGS` (comma-separated).
 */
export function whatsappPilotAllowSubstrings(): string[] {
  const env = process.env.GEOTRAVEL_WHATSAPP_PILOT_PHONE_SUBSTRINGS?.trim();
  const fromEnv = env
    ? env.split(/[,;]/).map((s) => s.replace(/\D/g, "")).filter(Boolean)
    : [];
  const merged = [
    WHATSAPP_PILOT_PHONE_DIGITS,
    WHATSAPP_PILOT_PHONE_DIGITS_351913535544,
    WHATSAPP_PILOT_NATIONAL_913535544,
    ...fromEnv,
  ];
  return [...new Set(merged.filter((s) => s.length >= 6))];
}

export function bookingHasPilotPhone(booking: GeotravelBooking): boolean {
  const d = (booking.passenger_phone ?? "").replace(/\D/g, "");
  return whatsappPilotAllowSubstrings().some((sub) => d.includes(sub));
}

function formatRouteStop(
  city: string | null,
  address: string | null,
): string | null {
  const parts = [city?.trim(), address?.trim()].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" — ");
}

function guessLanguage(booking: GeotravelBooking): SupportedLanguage {
  const c = (booking.invoice_country ?? "").toLowerCase();
  if (c.includes("portugal") || c === "pt") return "pt";
  if (c.startsWith("es") || c === "spain") return "es";
  if (c.startsWith("fr") || c === "france") return "fr";
  if (c.startsWith("de") || c === "germany" || c === "deutschland") return "de";
  const phone = (booking.passenger_phone ?? "").replace(/\D/g, "");
  if (phone.startsWith("351")) return "pt";
  return "pt";
}

function yesNoFooter(lang: SupportedLanguage): string {
  if (lang === "pt") {
    return "\n\nEstá tudo correto? Responda *SIM* para confirmar ou *NÃO* se algum dado estiver errado.";
  }
  if (lang === "es") {
    return "\n\n¿Todo es correcto? Responda *SÍ* para confirmar o *NO* si algo no cuadra.";
  }
  if (lang === "fr") {
    return "\n\nTout est correct ? Répondez *OUI* pour confirmer ou *NON* si quelque chose est incorrect.";
  }
  if (lang === "de") {
    return "\n\nIst alles korrekt? Antworten Sie *JA* zur Bestätigung oder *NEIN*, wenn etwas nicht stimmt.";
  }
  return "\n\nIs everything correct? Reply *YES* to confirm or *NO* if something is wrong.";
}

/** First token of passenger name for Meta template `{{first_name}}` (max 60 chars). */
export function firstNameForBookingWelcomeTemplate(
  passengerName: string | null | undefined,
): string {
  const t = passengerName?.trim();
  if (!t) return "there";
  const first = (t.split(/\s+/)[0] ?? t).slice(0, 60);
  return first || "there";
}

/** Plain-text preview of the approved welcome template body (for DB + SMS fallback). */
export function buildBookingWelcomeTemplateBody(firstName: string): string {
  return `Hello ${firstName}, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer. If you have any questions, just reply to this message.`;
}

/**
 * First WhatsApp for a row from the Geotravel Data API: trip summary + enrichment
 * questions, plus an explicit binary confirmation (SIM/NÃO, etc.).
 */
export function buildGeotravelWhatsAppConfirmationMessage(
  booking: GeotravelBooking,
): string {
  const lang = guessLanguage(booking);
  const ref = booking.booking_reference?.trim() || String(booking.id);
  const pickup =
    formatRouteStop(booking.pickup_city, booking.pickup_address) ?? "—";
  const dropoff =
    formatRouteStop(booking.dropoff_city, booking.dropoff_address) ?? "—";

  const core = buildInitialOutreachMessage({
    customerName: booking.passenger_name,
    externalBookingId: ref,
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    pickupDatetimeIso: booking.pickup_date_time,
    contactPreferredLanguage: lang,
  });
  return `${core}${yesNoFooter(lang)}`;
}

export function isBookingEligibleForWhatsAppConfirmation(
  booking: GeotravelBooking,
): boolean {
  const digits = (booking.passenger_phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return false;
  return bookingHasPilotPhone(booking);
}
