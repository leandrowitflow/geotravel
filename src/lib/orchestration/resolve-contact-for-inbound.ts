import { assertNoError, takeRows } from "@/db/supabase-helpers";
import { normalizeGeotravelPhoneToE164 } from "@/lib/phone/normalize-geotravel-e164";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Strip to digits only (for equality checks after canonicalization). */
export function digitsOnlyPhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Raw E.164-style: + then digits (no PT national heuristics). */
export function normalizeMessagingE164(raw: string): string {
  const digits = digitsOnlyPhone(raw);
  if (digits.length < 8) return raw.trim() || raw;
  return `+${digits}`;
}

function defaultCountryCode(): string {
  return (process.env.DEFAULT_PHONE_COUNTRY_CODE ?? "351").replace(/\D/g, "") || "351";
}

/**
 * Canonical numbers we use when sending (Geotravel API / template) and when
 * matching inbound WhatsApp `from` — avoids treating PT national "966…" as Saudi +966….
 */
export function canonicalInboundPhoneCandidates(fromE164: string): string[] {
  const raw = fromE164.trim();
  const cc = defaultCountryCode();
  const out = new Set<string>();

  const geo = normalizeGeotravelPhoneToE164(raw, { defaultCountryCode: cc });
  if (geo) out.add(geo);

  const geoDigits = normalizeGeotravelPhoneToE164(digitsOnlyPhone(raw), {
    defaultCountryCode: cc,
  });
  if (geoDigits) out.add(geoDigits);

  if (!geo && !geoDigits) {
    const msg = normalizeMessagingE164(raw);
    if (digitsOnlyPhone(msg).length >= 8) out.add(msg);
  }

  for (const c of [...out]) {
    if (c.startsWith("+")) out.add(c.slice(1));
  }
  if (raw.length >= 8 && !out.has(raw)) out.add(raw);

  return [...out];
}

/**
 * Meta webhook `messages[].from` (digits only, no +) → canonical E.164 for lookups.
 * Applies PT national rules so `966915976` becomes `+351966915976`, not Saudi `+966…`.
 */
export function canonicalizeInboundWebhookFrom(fromRaw: string): string | null {
  const trimmed = fromRaw.trim();
  if (!trimmed) return null;
  const e164 = primaryCanonicalInboundPhone(trimmed);
  if (digitsOnlyPhone(e164).length < 8) return null;
  return e164;
}

/** Preferred single E.164 to store on `contacts.phone` when healing. */
export function primaryCanonicalInboundPhone(fromE164: string): string {
  const cc = defaultCountryCode();
  return (
    normalizeGeotravelPhoneToE164(fromE164.trim(), { defaultCountryCode: cc }) ??
    normalizeGeotravelPhoneToE164(digitsOnlyPhone(fromE164), {
      defaultCountryCode: cc,
    }) ??
    normalizeMessagingE164(fromE164)
  );
}

export type ResolveContactForInboundResult =
  | { ok: true; contactRaw: Record<string, unknown> }
  | { ok: false; reason: "unknown_contact" };

/**
 * Exact lookup on known phone variants (same rules as outbound / sync).
 * No cross-table fuzzy scans — only `contacts.phone` and `reservations.source_phone`
 * matching the candidate set built from the inbound caller id.
 */
export async function resolveContactForInboundPhone(
  fromE164: string,
  sb: SupabaseClient,
): Promise<ResolveContactForInboundResult> {
  const keys = canonicalInboundPhoneCandidates(fromE164);
  if (keys.length === 0) {
    return { ok: false, reason: "unknown_contact" };
  }

  const primary = primaryCanonicalInboundPhone(fromE164);

  const byContact = takeRows<Record<string, unknown>>(
    "contact by phone variants",
    await sb
      .from("contacts")
      .select("*")
      .in("phone", keys)
      .order("updated_at", { ascending: false })
      .limit(1),
  );
  if (byContact[0]) {
    return { ok: true, contactRaw: byContact[0] };
  }

  const byRes = takeRows<Record<string, unknown>>(
    "reservation by source_phone variants",
    await sb
      .from("reservations")
      .select("id, source_phone")
      .in("source_phone", keys)
      .order("updated_at", { ascending: false })
      .limit(1),
  );
  const resRow = byRes[0];
  if (!resRow?.id) {
    return { ok: false, reason: "unknown_contact" };
  }

  const cont = takeRows<Record<string, unknown>>(
    "contact for reservation",
    await sb
      .from("contacts")
      .select("*")
      .eq("reservation_id", String(resRow.id))
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const contactRow = cont[0];
  if (!contactRow) {
    return { ok: false, reason: "unknown_contact" };
  }

  const stored = String(contactRow.phone ?? "");
  const storedCanon =
    normalizeGeotravelPhoneToE164(stored, { defaultCountryCode: defaultCountryCode() }) ??
    normalizeMessagingE164(stored);
  if (storedCanon !== primary) {
    assertNoError(
      "heal contact phone to canonical inbound",
      await sb
        .from("contacts")
        .update({
          phone: primary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contactRow.id),
    );
    return { ok: true, contactRaw: { ...contactRow, phone: primary } };
  }

  return { ok: true, contactRaw: contactRow };
}
