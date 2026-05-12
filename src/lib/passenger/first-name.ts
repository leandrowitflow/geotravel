/** First token of a display name for greetings (WhatsApp, templates, AI prompts). */
export function firstNameFromDisplayName(
  customerName: string | null | undefined,
): string | null {
  const t = (customerName ?? "").trim();
  if (!t) return null;
  const first = t.split(/\s+/)[0];
  return first.length > 0 ? first : null;
}
