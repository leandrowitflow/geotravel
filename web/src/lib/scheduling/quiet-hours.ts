function parseHourEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Uses server local timezone. For production, pass customer TZ or UTC policy. */
export function isQuietHourNow(date = new Date()): boolean {
  const start = parseHourEnv("QUIET_HOURS_START_HOUR", 22);
  const end = parseHourEnv("QUIET_HOURS_END_HOUR", 7);
  const h = date.getHours();
  if (start <= end) {
    return h >= start && h < end;
  }
  return h >= start || h < end;
}

export function minutesUntilQuietEnds(date = new Date()): number {
  const end = parseHourEnv("QUIET_HOURS_END_HOUR", 7);
  const h = date.getHours();
  const m = date.getMinutes();
  if (h < end) {
    return (end - h) * 60 - m;
  }
  return (24 - h + end) * 60 - m;
}

export function defaultRetryDelayMinutes(): number {
  const base = Number.parseInt(process.env.RETRY_BASE_MINUTES ?? "120", 10);
  return Number.isFinite(base) ? base : 120;
}

export function maxOutboundAttempts(): number {
  const n = Number.parseInt(process.env.MAX_OUTBOUND_ATTEMPTS ?? "5", 10);
  return Number.isFinite(n) ? n : 5;
}
