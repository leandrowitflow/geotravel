import twilio from "twilio";
import type { OutboundMessage, SendResult } from "./types";

export async function sendTwilioSms(msg: OutboundMessage): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: "twilio_not_configured" };
  }
  const client = twilio(sid, token);
  try {
    const created = await client.messages.create({
      to: msg.toE164,
      from,
      body: msg.body.slice(0, 1600),
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
    });
    return {
      ok: true,
      providerMessageId: created.sid,
      channel: "sms",
    };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? "twilio_send_failed" };
  }
}
