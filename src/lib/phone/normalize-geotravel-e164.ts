/**
 * Geotravel passenger numbers from the Data API are often national (9 digits) or
 * already international. A bare "966915976" must become +351966915976 — not
 * +966915976 (E.164 country code 966 is Saudi Arabia).
 */
export function normalizeGeotravelPhoneToE164(
  raw: string | null | undefined,
  options?: { defaultCountryCode?: string },
): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  while (digits.startsWith("00") && digits.length > 2) {
    digits = digits.slice(2);
  }

  const cc = (options?.defaultCountryCode ?? "351").replace(/\D/g, "");

  if (digits.startsWith(cc) && digits.length >= cc.length + 8) {
    return `+${digits}`;
  }

  // Portugal: national numbers are 9 digits (mobile 9…, landline 2…).
  if (cc === "351" && digits.length === 9) {
    return `+${cc}${digits}`;
  }

  return `+${digits}`;
}
