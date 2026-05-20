import type { SupportedLanguage } from "@/lib/contracts/extraction";
import { isPortugueseRecipientPhone } from "@/lib/phone/is-portuguese-phone";

/** Languages the WhatsApp assistant may write in. */
export const ASSISTANT_LOCALES = ["en", "pt"] as const;
export type AssistantLocale = (typeof ASSISTANT_LOCALES)[number];

/** Shared voice: professional private-transfer concierge (WhatsApp). */
export const ASSISTANT_PROFESSIONAL_TONE = `Tone and register (mandatory):
- Professional, courteous, and calm — like a premium airport transfer service.
- Clear and concise; complete sentences; no slang, emojis, or exclamation marks unless the customer used them first.
- Do not sound robotic, overly casual, or sales-driven.`;

export function assistantLocaleStyleBlock(locale: AssistantLocale): string {
  if (locale === "pt") {
    return `${ASSISTANT_PROFESSIONAL_TONE}
- Write in European Portuguese (Portugal): pt-PT vocabulary and spelling only.
- Use "connosco", "equipa", "telemóvel", "autocarro" where relevant — never Brazilian Portuguese (pt-BR).
- Polite address: "a sua reserva", "o seu transfer"; avoid informal filler ("ok", "fixe", "você" alone as filler).`;
  }
  return `${ASSISTANT_PROFESSIONAL_TONE}
- Write in British English (UK): UK spelling (e.g. organise, travelling, centre) and phrasing.
- Avoid Americanisms (e.g. vacation, gotten, awesome, "you guys").
- Prefer "Thank you", "We will", "Our team" over overly casual "Thanks!", "We'll", "Hey".`;
}

export function assistantLocaleLabel(locale: AssistantLocale): string {
  return locale === "pt"
    ? "European Portuguese (Portugal)"
    : "British English";
}

/** Map any stored language to en or pt for assistant output. */
export function toAssistantLocale(lang: SupportedLanguage): AssistantLocale {
  return lang === "pt" ? "pt" : "en";
}

/** Default assistant language from passenger phone (+351 → pt). */
export function assistantFallbackFromPhone(
  phone: string | null | undefined,
): AssistantLocale {
  return isPortugueseRecipientPhone(phone) ? "pt" : "en";
}

function localeOf(lang: SupportedLanguage): AssistantLocale {
  return toAssistantLocale(lang);
}

export function cannedNeedsHumanAck(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Obrigado pela sua mensagem. A nossa equipa responderá em breve."
    : "Thank you for your message. Our team will respond shortly.";
}

export function cannedWhatsappCatchAllReply(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Obrigado pela sua mensagem. Se precisar de assistência com o seu transfer, indique-nos e a nossa equipa ajudará."
    : "Thank you for your message. If you require assistance with your transfer, please let us know and our team will help.";
}

export function cannedCrmHandoffAfterSyncFail(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Recebemos os seus dados, mas ocorreu um problema técnico ao guardá-los. A nossa equipa concluirá o processo manualmente e contactá-lo-á se necessário."
    : "We have received your details, but a technical issue occurred whilst saving them. Our team will complete this manually and contact you if required.";
}

export function cannedWhatsappTemplateAwareReply(
  lang: SupportedLanguage,
  phase: "canceled" | "satisfaction",
): string {
  const locale = localeOf(lang);
  if (phase === "canceled") {
    return locale === "pt"
      ? "Obrigado pela sua mensagem. Lamentamos o cancelamento — a nossa equipa responderá em breve caso necessite de esclarecimentos ou de um novo transfer."
      : "Thank you for your message. We are sorry to hear of the cancellation — our team will respond shortly should you require any clarification or a new booking.";
  }
  return locale === "pt"
    ? "Obrigado por viajar connosco. Como correu o transfer? A sua opinião é importante — pode responder aqui quando for conveniente."
    : "Thank you for travelling with us. How was your transfer? Your feedback is appreciated — you may reply here at your convenience.";
}

export function scriptedConsentFutureComms(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Podemos enviar lembretes úteis sobre o seu transfer por WhatsApp ou SMS no futuro? Responda SIM ou NÃO."
    : "May we send helpful reminders about your transfer by WhatsApp or SMS in future? Please reply YES or NO.";
}

export function scriptedEnrichmentCompleteAck(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Obrigado. Confirmaremos consigo no dia anterior à viagem."
    : "Thank you. We will confirm with you the day before travel.";
}

export function scriptedSummarizeCorrectionAsk(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "O que devemos corrigir? Indique os detalhes na sua resposta."
    : "What should we correct? Please reply with the relevant details.";
}

export function scriptedCommercialReturnTransfer(lang: SupportedLanguage): string {
  const locale = localeOf(lang);
  return locale === "pt"
    ? "Deseja que reservemos também o transfer de regresso?"
    : "Would you like us to arrange your return transfer as well?";
}

/** Prompt prefix for all OpenAI assistant generations. */
export function assistantSystemPreamble(locale: AssistantLocale): string {
  return `You are Geotravel's WhatsApp assistant for private airport transfers.

${assistantLocaleStyleBlock(locale)}

Write the entire reply in ${assistantLocaleLabel(locale)} only — never mix languages.`;
}
