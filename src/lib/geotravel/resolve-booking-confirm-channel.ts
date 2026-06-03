import { isInfobipSmsConfigured } from "@/lib/messaging/infobip-config";

export type BookingConfirmChannel = "whatsapp" | "sms";

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveBookingConfirmChannel(input?: {
  channelOverride?: BookingConfirmChannel;
}): BookingConfirmChannel {
  if (input?.channelOverride) return input.channelOverride;
  if (envTruthy("GEOTRAVEL_BOOKING_CONFIRM_FORCE_SMS")) return "sms";
  const pref = process.env.GEOTRAVEL_BOOKING_CONFIRM_PREFERRED_CHANNEL
    ?.trim()
    .toLowerCase();
  if (pref === "sms") return "sms";
  return "whatsapp";
}

/** SMS lifecycle sends need Infobip; otherwise fall back to WhatsApp when possible. */
export function effectiveBookingConfirmChannel(input?: {
  channelOverride?: BookingConfirmChannel;
}): BookingConfirmChannel {
  const requested = resolveBookingConfirmChannel(input);
  if (requested === "sms" && !isInfobipSmsConfigured()) {
    return "whatsapp";
  }
  return requested;
}
