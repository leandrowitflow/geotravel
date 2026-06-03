import type { MessagingChannel } from "@/lib/messaging/types";
import { SMS_LIFECYCLE_MAX_CHARS } from "@/lib/geotravel/build-lifecycle-sms-body";

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function envDisabled(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

/** GPT polish + template-aware replies on WhatsApp and SMS. */
export function messagingAiConversationEnabled(): boolean {
  if (envDisabled("MESSAGING_AI_CONVERSATION")) return false;
  if (envTruthy("MESSAGING_AI_CONVERSATION")) return true;
  if (envDisabled("WHATSAPP_AI_CONVERSATION")) return false;
  return true;
}

export function isTextMessagingChannel(
  channel: MessagingChannel,
): channel is "whatsapp" | "sms" {
  return channel === "whatsapp" || channel === "sms";
}

/** Keep AI/SMS replies deliverable on PT carriers (1–2 segments). */
export function clampSmsReply(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= SMS_LIFECYCLE_MAX_CHARS) return t;
  return `${t.slice(0, SMS_LIFECYCLE_MAX_CHARS - 1)}…`;
}
