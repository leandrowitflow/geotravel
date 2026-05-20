import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { isGeotravelWhatsappLifecycleTemplate } from "@/lib/geotravel/select-booking-whatsapp-template";

const DEFAULT_BOOKING_CONFIRM_TEMPLATE = "booking_confirmation";
import { isPortugueseRecipientPhone } from "@/lib/phone/is-portuguese-phone";

/** Meta language codes on our WABA (run npm run whatsapp:template-params). */
export const META_WHATSAPP_TEMPLATE_LANGUAGE_EN = "en" as const;
export const META_WHATSAPP_TEMPLATE_LANGUAGE_PT_PT = "pt_PT" as const;

export type MetaWhatsappTemplateLanguage =
  | typeof META_WHATSAPP_TEMPLATE_LANGUAGE_EN
  | typeof META_WHATSAPP_TEMPLATE_LANGUAGE_PT_PT;

export type WhatsappTemplateLanguageContext = {
  booking?: GeotravelBooking;
  destinationE164?: string | null;
};

export function resolveWhatsappTemplateLanguage(
  templateName: string | undefined,
  context: WhatsappTemplateLanguageContext = {},
): string {
  const usePt = isPortugueseRecipientPhone(
    context.booking?.passenger_phone,
    context.destinationE164,
  );
  const lifecycleLang = usePt
    ? META_WHATSAPP_TEMPLATE_LANGUAGE_PT_PT
    : META_WHATSAPP_TEMPLATE_LANGUAGE_EN;

  if (templateName && isGeotravelWhatsappLifecycleTemplate(templateName)) {
    return lifecycleLang;
  }

  const specific = process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_LANGUAGE?.trim();
  if (specific) return specific;

  const name =
    templateName?.trim() ||
    process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME?.trim() ||
    DEFAULT_BOOKING_CONFIRM_TEMPLATE;

  if (name === "booking_confirmation" || name === "booking_confirm") {
    return usePt ? META_WHATSAPP_TEMPLATE_LANGUAGE_PT_PT : META_WHATSAPP_TEMPLATE_LANGUAGE_EN;
  }

  return process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE?.trim() || "en_US";
}
