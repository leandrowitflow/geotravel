/**
 * Whether a passenger number should receive Portugal Portuguese (pt_PT) WhatsApp templates.
 * Uses E.164 when available; otherwise Geotravel national 9-digit PT numbers.
 */
export function isPortuguesePhoneE164(e164: string | null | undefined): boolean {
  if (!e164?.trim()) return false;
  const digits = e164.replace(/\D/g, "");
  return digits.startsWith("351") && digits.length >= 11;
}

export function isPortuguesePhoneRaw(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  let digits = raw.replace(/\D/g, "");
  while (digits.startsWith("00") && digits.length > 2) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("351") && digits.length >= 11) return true;
  // Portugal national: 9 digits (mobile 9…, landline 2…)
  if (digits.length === 9 && /^[29]\d{8}$/.test(digits)) return true;
  return false;
}

export function isPortugueseRecipientPhone(
  raw: string | null | undefined,
  destinationE164?: string | null,
): boolean {
  if (isPortuguesePhoneE164(destinationE164)) return true;
  return isPortuguesePhoneRaw(raw);
}
