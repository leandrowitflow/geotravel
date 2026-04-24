import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendWhatsAppMessage } from "./meta-whatsapp";
import { sendTwilioSms } from "./twilio-sms";
import type { MessagingChannel, OutboundMessage, SendResult } from "./types";

export async function sendViaPreferredChannel(input: {
  caseId: string;
  reservationId: string;
  preferred: MessagingChannel;
  toE164: string;
  body: string;
  templateName?: string;
  templateVariables?: Record<string, string>;
}): Promise<SendResult> {
  const base: OutboundMessage = {
    toE164: input.toE164,
    body: input.body,
    channel: input.preferred,
    templateName: input.templateName,
    templateVariables: input.templateVariables,
  };
  let result: SendResult =
    input.preferred === "whatsapp"
      ? await sendWhatsAppMessage(base)
      : await sendTwilioSms({ ...base, channel: "sms" });

  if (!result.ok && input.preferred === "whatsapp") {
    await writeBehaviouralEvent({
      eventType: "fallback_sms_triggered",
      caseId: input.caseId,
      reservationId: input.reservationId,
      channel: "sms",
    });
    result = await sendTwilioSms({
      ...base,
      channel: "sms",
      body: input.body.slice(0, 300),
    });
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
