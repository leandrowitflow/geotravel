/** Infobip SMS sender: E.164 digits (e.g. 351923250271) or alphanumeric ID. */
export function infobipSmsSender(): string | null {
  const raw =
    process.env.INFOBIP_SMS_SENDER?.trim() ||
    process.env.INFOBIP_SMS_NUMBER?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits;
  return raw;
}

export function infobipSmsNumberId(): string | null {
  return process.env.INFOBIP_SMS_NUMBER_ID?.trim() || null;
}

export function isInfobipSmsConfigured(): boolean {
  const base = process.env.INFOBIP_BASE_URL?.trim();
  const key = process.env.INFOBIP_API_KEY?.trim();
  return Boolean(base && key && infobipSmsSender());
}

/** E.164-style label for admin UI (e.g. +447860030523). */
export function formatInfobipSmsSenderDisplay(
  sender: string | null = infobipSmsSender(),
): string | null {
  if (!sender) return null;
  const digits = sender.replace(/\D/g, "");
  if (digits.length >= 8) return `+${digits}`;
  return sender;
}
