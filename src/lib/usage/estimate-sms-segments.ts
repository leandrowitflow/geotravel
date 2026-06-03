/** Portuguese and most non-English SMS use UCS-2 (70/67 chars per segment). */
export function smsUsesUcs2Encoding(text: string): boolean {
  if (!text) return false;
  return /[^\x00-\x7F]/.test(text);
}

/**
 * Estimate billable SMS parts (Infobip / carrier multipart rules).
 * Uses API messageCount when present; otherwise heuristic.
 */
export function estimateSmsSegments(text: string, apiMessageCount?: number): number {
  if (apiMessageCount != null && apiMessageCount > 0) {
    return Math.ceil(apiMessageCount);
  }
  const len = text.length;
  if (len === 0) return 0;
  if (smsUsesUcs2Encoding(text)) {
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}
