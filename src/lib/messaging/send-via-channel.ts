import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendInfobipSms } from "./infobip-sms";
import { sendWhatsAppMessage } from "./meta-whatsapp";
import type { MessagingChannel, OutboundMessage, SendResult } from "./types";

/** When false, failed WhatsApp sends are not retried via Infobip SMS. */
export function isWhatsappSmsFallbackEnabled(): boolean {
  const v = process.env.WHATSAPP_SMS_FALLBACK_AFTER_FAILURE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

export async function sendViaPreferredChannel(input: {
  caseId: string;
  reservationId: string;
  preferred: MessagingChannel;
  toE164: string;
  body: string;
  /** When set, Infobip sends this text (e.g. rendered lifecycle template) instead of `body`. */
  smsBody?: string;
  templateName?: string;
  templateLanguageCode?: string;
  templateVariables?: Record<string, string>;
  linkPreview?: boolean;
}): Promise<SendResult> {
  const usageContext = {
    caseId: input.caseId,
    reservationId: input.reservationId,
    operation: "outbound_send",
  };
  const base: OutboundMessage = {
    toE164: input.toE164,
    body: input.body,
    channel: input.preferred,
    usageContext,
    templateName: input.templateName,
    templateLanguageCode: input.templateLanguageCode,
    templateVariables: input.templateVariables,
    linkPreview: input.linkPreview,
  };
  const smsOutboundText = (input.smsBody ?? input.body).trim().slice(0, 1600);

  let result: SendResult =
    input.preferred === "whatsapp"
      ? await sendWhatsAppMessage(base)
      : await sendInfobipSms({
          ...base,
          channel: "sms",
          body: smsOutboundText,
        });

  let whatsappErrorBeforeSmsFallback: string | undefined;
  if (
    !result.ok &&
    input.preferred === "whatsapp" &&
    isWhatsappSmsFallbackEnabled()
  ) {
    whatsappErrorBeforeSmsFallback = result.error;
    await writeBehaviouralEvent({
      eventType: "fallback_sms_triggered",
      caseId: input.caseId,
      reservationId: input.reservationId,
      channel: "sms",
    });
    result = await sendInfobipSms({
      ...base,
      channel: "sms",
      body: smsOutboundText,
    });
  }

  if (result.ok && whatsappErrorBeforeSmsFallback && result.channel === "sms") {
    return {
      ...result,
      whatsappErrorBeforeSmsFallback,
    };
  }

  if (result.ok) {
    await writeBehaviouralEvent({
      eventType: "outbound_message_sent",
      caseId: input.caseId,
      reservationId: input.reservationId,
      channel: result.channel,
      payload: { providerMessageId: result.providerMessageId },
    });
  }
  return result;
}
