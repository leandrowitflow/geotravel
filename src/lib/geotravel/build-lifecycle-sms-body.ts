import {
  interpolateWhatsappTemplateBody,
  normalizeTemplateDisplayLanguage,
  type WhatsappTemplateDisplayLanguage,
} from "@/lib/admin/whatsapp-template-display";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { buildBookingWhatsappTemplateVariables } from "@/lib/geotravel/build-booking-whatsapp-template-variables";
import { GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES } from "@/lib/geotravel/select-booking-whatsapp-template";

/**
 * Final SMS bodies (≤2 segments on PT carriers). WhatsApp keeps full Meta templates.
 * Variables come from buildBookingWhatsappTemplateVariables (same as WhatsApp).
 */
const SMS_SHELLS: Record<
  string,
  Partial<Record<WhatsappTemplateDisplayLanguage, string>>
> = {
  welcome_1: {
    en: "{{operator}} ({{plateform}}): Booking {{booking_reference}} confirmed for {{pickup_date_time}}. We will contact you 72h before travel. Reply with your email if you wish.",
    pt_PT:
      "{{operator}} ({{plateform}}): Reserva {{booking_reference}} confirmada para {{pickup_date_time}}. Contactamos 72h antes da viagem. Pode indicar o seu email.",
  },
  welcome_2: {
    en: "{{operator}} ({{plateform}}): Booking {{booking_reference}} confirmed for {{pickup_date_time}}. We will contact you shortly before pickup.",
    pt_PT:
      "{{operator}} ({{plateform}}): Reserva {{booking_reference}} confirmada para {{pickup_date_time}}. Contactamos antes do inicio da viagem.",
  },
  data: {
    en: "{{operator}} ({{plateform}}): Transfer {{pickup_city}} to {{dropoff_city}} on {{pickup_date_time}}. Reply with passengers, cabin bags, checked bags, extras (baby seat, etc.).",
    pt_PT:
      "{{operator}} ({{plateform}}): Transfer {{pickup_city}} - {{dropoff_city}} em {{pickup_date_time}}. Indique passageiros, malas de mao, porao e extras (cadeira bebe, etc.).",
  },
  canceled: {
    en: "{{operator}} ({{plateform}}): Cancellation of booking {{booking_reference}} ({{pickup_date_time}}) is registered. Contact us if you need help.",
    pt_PT:
      "{{operator}} ({{plateform}}): Cancelamento da reserva {{booking_reference}} ({{pickup_date_time}}) registado. Contacte-nos se precisar.",
  },
  satisfaction: {
    en: "Geotravel: Thank you for your transfer with {{operator}}. How was your trip? Reply with any feedback.",
    pt_PT:
      "Geotravel: Obrigado pelo transfer com {{operator}}. Como correu a viagem? Pode enviar feedback.",
  },
  booking_confirmation: {
    en: "Hello {{first_name}}, {{operator}} here about your transfer. Reply to confirm details or ask a question.",
    pt_PT:
      "Ola {{first_name}}, {{operator}} sobre o seu transfer. Responda para confirmar dados ou colocar uma questao.",
  },
  booking_confirm: {
    en: "Hello {{first_name}}, {{operator}} here about your transfer. Reply to confirm details or ask a question.",
    pt_PT:
      "Ola {{first_name}}, {{operator}} sobre o seu transfer. Responda para confirmar dados ou colocar uma questao.",
  },
};

/** GSM-friendly cap; UCS-2 still ≤2 parts on most carriers (~306 chars). */
export const SMS_LIFECYCLE_MAX_CHARS = 300;

export const SMS_LIFECYCLE_TEMPLATE_NAMES = [
  ...GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES,
  "booking_confirmation",
  "booking_confirm",
] as const;

/** Same variable map as WhatsApp Meta templates (operator, plateform, ref, cities, etc.). */
export function resolveLifecycleTemplateVariables(
  booking: GeotravelBooking,
  templateName: string,
  firstName: string,
): Record<string, string> {
  return (
    buildBookingWhatsappTemplateVariables(booking, templateName, firstName) ?? {
      operator: process.env.GEOTRAVEL_WHATSAPP_OPERATOR?.trim() || "Geotravel",
      first_name: firstName,
    }
  );
}

function polishSmsInterpolatedText(text: string): string {
  return text
    .replace(/\(\s*—\s*\)/g, "")
    .replace(/\s+—\s+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildLifecycleSmsBody(input: {
  templateName: string;
  templateVariables?: Record<string, string>;
  languageCode: string;
}): string | null {
  const lang = normalizeTemplateDisplayLanguage(input.languageCode);
  const name = input.templateName.trim();
  const shell = SMS_SHELLS[name]?.[lang] ?? SMS_SHELLS[name]?.en;
  if (!shell) return null;
  let text = interpolateWhatsappTemplateBody(
    shell,
    input.templateVariables ?? {},
  );
  text = polishSmsInterpolatedText(text);
  if (text.length > SMS_LIFECYCLE_MAX_CHARS) {
    return `${text.slice(0, SMS_LIFECYCLE_MAX_CHARS - 1)}…`;
  }
  return text;
}

/** Preferred path: booking row → variables → SMS text. */
export function buildLifecycleSmsBodyFromBooking(input: {
  booking: GeotravelBooking;
  templateName: string;
  languageCode: string;
  firstName: string;
}): string | null {
  const templateVariables = resolveLifecycleTemplateVariables(
    input.booking,
    input.templateName,
    input.firstName,
  );
  return buildLifecycleSmsBody({
    templateName: input.templateName,
    templateVariables,
    languageCode: input.languageCode,
  });
}
