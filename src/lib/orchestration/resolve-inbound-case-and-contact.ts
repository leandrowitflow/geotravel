import { takeRows } from "@/db/supabase-helpers";
import {
  canonicalInboundPhoneCandidates,
  primaryCanonicalInboundPhone,
  resolveContactForInboundPhone,
} from "@/lib/orchestration/resolve-contact-for-inbound";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolveInboundCaseAndContactResult =
  | {
      ok: true;
      contactRaw: Record<string, unknown>;
      caseRaw: Record<string, unknown>;
      /** When multiple reservations share this phone. */
      matchedCaseCount: number;
    }
  | { ok: false; reason: "unknown_contact" | "case_not_found" };

type CaseCandidate = {
  caseRaw: Record<string, unknown>;
  reservationId: string;
  lastMessageAt: number;
  hasInbound: boolean;
  messageCount: number;
};

function scoreCase(c: CaseCandidate): number {
  let score = c.lastMessageAt;
  if (c.hasInbound) score += 1e15;
  if (c.messageCount > 0) score += 1e14;
  if (String(c.caseRaw.case_status) === "active") score += 1e12;
  const orch = String(c.caseRaw.orchestration_state ?? "");
  if (orch !== "closed" && orch !== "cancelled") score += 1e11;
  if (
    orch === "collect_missing" ||
    orch === "identity_confirm" ||
    orch === "summarize_confirm"
  ) {
    score += 1e10;
  }
  return score;
}

/**
 * Same phone can map to several reservations/cases (e.g. new booking sync).
 * Route inbound WhatsApp to the case with the active conversation (latest message),
 * not merely the most recently updated contact row.
 */
export async function resolveInboundCaseAndContact(
  fromE164: string,
  sb: SupabaseClient,
): Promise<ResolveInboundCaseAndContactResult> {
  const keys = canonicalInboundPhoneCandidates(fromE164);
  if (keys.length === 0) {
    return { ok: false, reason: "unknown_contact" };
  }

  const contactRows = takeRows<Record<string, unknown>>(
    "contacts by phone variants",
    await sb
      .from("contacts")
      .select("*")
      .in("phone", keys),
  );

  const reservationIds = new Set<string>();
  for (const c of contactRows) {
    if (c.reservation_id) reservationIds.add(String(c.reservation_id));
  }

  const resByPhone = takeRows<{ id: string }>(
    "reservations by source_phone",
    await sb
      .from("reservations")
      .select("id")
      .in("source_phone", keys),
  );
  for (const r of resByPhone) {
    reservationIds.add(String(r.id));
  }

  if (reservationIds.size === 0) {
    const fallback = await resolveContactForInboundPhone(fromE164, sb);
    if (!fallback.ok) return { ok: false, reason: "unknown_contact" };
    return loadSingleCaseForContact(fallback.contactRaw, sb, 1);
  }

  const caseRows = takeRows<Record<string, unknown>>(
    "cases for phone reservations",
    await sb
      .from("cases")
      .select("*")
      .in("reservation_id", [...reservationIds])
      .order("updated_at", { ascending: false }),
  );

  if (caseRows.length === 0) {
    const fallback = await resolveContactForInboundPhone(fromE164, sb);
    if (!fallback.ok) return { ok: false, reason: "unknown_contact" };
    return loadSingleCaseForContact(fallback.contactRaw, sb, 1);
  }

  const caseIds = caseRows.map((c) => String(c.id));
  const recentMsgs = takeRows<{
    case_id: string;
    created_at: string;
    direction: string;
  }>(
    "recent messages for inbound case pick",
    await sb
      .from("messages")
      .select("case_id,created_at,direction")
      .in("case_id", caseIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(caseIds.length * 20, 500)),
  );

  const msgMeta = new Map<
    string,
    { lastAt: number; hasInbound: boolean; count: number }
  >();
  for (const m of recentMsgs) {
    const cid = String(m.case_id);
    const at = new Date(String(m.created_at)).getTime();
    const prev = msgMeta.get(cid);
    if (!prev) {
      msgMeta.set(cid, {
        lastAt: at,
        hasInbound: m.direction === "inbound",
        count: 1,
      });
    } else {
      prev.count += 1;
      if (m.direction === "inbound") prev.hasInbound = true;
      if (at > prev.lastAt) prev.lastAt = at;
    }
  }

  const candidates: CaseCandidate[] = caseRows.map((caseRaw) => {
    const cid = String(caseRaw.id);
    const meta = msgMeta.get(cid);
    return {
      caseRaw,
      reservationId: String(caseRaw.reservation_id),
      lastMessageAt: meta?.lastAt ?? 0,
      hasInbound: meta?.hasInbound ?? false,
      messageCount: meta?.count ?? 0,
    };
  });

  candidates.sort((a, b) => scoreCase(b) - scoreCase(a));
  const winner = candidates[0];
  const contactForRes = await contactForReservation(
    winner.reservationId,
    contactRows,
    sb,
    fromE164,
  );
  if (!contactForRes) {
    return { ok: false, reason: "unknown_contact" };
  }

  if (candidates.length > 1) {
    console.info("[pipeline] inbound routed to conversation case", {
      fromE164: primaryCanonicalInboundPhone(fromE164),
      caseId: String(winner.caseRaw.id),
      matchedCases: candidates.length,
      reservationId: winner.reservationId,
    });
  }

  return {
    ok: true,
    contactRaw: contactForRes,
    caseRaw: winner.caseRaw,
    matchedCaseCount: candidates.length,
  };
}

async function contactForReservation(
  reservationId: string,
  contactRows: Record<string, unknown>[],
  sb: SupabaseClient,
  fromE164: string,
): Promise<Record<string, unknown> | null> {
  const hit = contactRows.find((c) => String(c.reservation_id) === reservationId);
  if (hit) return hit;

  const rows = takeRows<Record<string, unknown>>(
    "contact for reservation id",
    await sb
      .from("contacts")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  if (rows[0]) return rows[0];

  const fallback = await resolveContactForInboundPhone(fromE164, sb);
  return fallback.ok ? fallback.contactRaw : null;
}

async function loadSingleCaseForContact(
  contactRaw: Record<string, unknown>,
  sb: SupabaseClient,
  matchedCaseCount: number,
): Promise<ResolveInboundCaseAndContactResult> {
  const reservationId = String(contactRaw.reservation_id);
  const caseRows = takeRows<Record<string, unknown>>(
    "case for reservation",
    await sb
      .from("cases")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  if (!caseRows[0]) {
    return { ok: false, reason: "case_not_found" };
  }
  return {
    ok: true,
    contactRaw,
    caseRaw: caseRows[0],
    matchedCaseCount,
  };
}
