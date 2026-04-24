import type {
  BehaviouralEventRow,
  CaseRow,
  CrmSyncAttemptRow,
  MessageRow,
  ReservationRow,
} from "@/db/schema";
import {
  mapBehaviouralEvent,
  mapCase,
  mapCrmSyncAttempt,
  mapMessage,
  mapReservation,
} from "@/db/map-supabase";
import { takeRows, takeSingle } from "@/db/supabase-helpers";
import { serviceSupabase } from "@/lib/supabase/service-role";

export type BookingRow = ReservationRow & {
  caseId: string | null;
  orchestrationState: string | null;
  enrichmentStatus: string | null;
  confirmationStatus: string | null;
  caseStatus: string | null;
  exceptionFlag: boolean;
  collectedData: import("@/db/schema").CollectedDataJson | null;
};

export async function listBookings(opts?: {
  search?: string;
  status?: string;
  limit?: number;
}): Promise<BookingRow[]> {
  const sb = serviceSupabase();
  const limit = opts?.limit ?? 200;

  let q = sb
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.status) {
    q = q.eq("booking_status", opts.status);
  }

  const resRows = takeRows<Record<string, unknown>>("list reservations", await q);
  if (resRows.length === 0) return [];

  const resIds = resRows.map((r) => String(r.id));
  const caseRows = takeRows<Record<string, unknown>>(
    "cases for bookings",
    await sb.from("cases").select("*").in("reservation_id", resIds),
  );
  const caseByResId = new Map<string, Record<string, unknown>>();
  for (const c of caseRows) {
    caseByResId.set(String(c.reservation_id), c);
  }

  return resRows.map((r) => {
    const res = mapReservation(r);
    const c = caseByResId.get(res.id);
    return {
      ...res,
      caseId: c ? String(c.id) : null,
      orchestrationState: c ? String(c.orchestration_state ?? "") : null,
      enrichmentStatus: c ? String(c.enrichment_status ?? "") : null,
      confirmationStatus: c ? String(c.confirmation_status ?? "") : null,
      caseStatus: c ? String(c.case_status ?? "") : null,
      exceptionFlag: c ? Boolean(c.exception_flag) : false,
      collectedData: c
        ? ((c.collected_data as import("@/db/schema").CollectedDataJson) ?? null)
        : null,
    };
  });
}

export async function listCasesWithReservation(): Promise<
  { case: CaseRow; reservation: ReservationRow }[]
> {
  const sb = serviceSupabase();
  const caseRows = takeRows<Record<string, unknown>>(
    "list cases",
    await sb
      .from("cases")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200),
  );
  if (caseRows.length === 0) return [];
  const resIds = [...new Set(caseRows.map((c) => String(c.reservation_id)))];
  const resRows = takeRows<Record<string, unknown>>(
    "list reservations for cases",
    await sb.from("reservations").select("*").in("id", resIds),
  );
  const byId = new Map(resRows.map((r) => [String(r.id), mapReservation(r)]));
  const out: { case: CaseRow; reservation: ReservationRow }[] = [];
  for (const c of caseRows) {
    const res = byId.get(String(c.reservation_id));
    if (res) out.push({ case: mapCase(c), reservation: res });
  }
  return out;
}

export async function getCaseDetail(caseId: string) {
  const sb = serviceSupabase();
  const caseRow = takeSingle<Record<string, unknown>>(
    "get case",
    await sb.from("cases").select("*").eq("id", caseId).maybeSingle(),
  );
  const c = mapCase(caseRow);
  const resRow = takeSingle<Record<string, unknown>>(
    "get reservation",
    await sb
      .from("reservations")
      .select("*")
      .eq("id", c.reservationId)
      .maybeSingle(),
  );
  const r = mapReservation(resRow);
  const msgRows = takeRows<Record<string, unknown>>(
    "messages",
    await sb
      .from("messages")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(100),
  );
  const evRows = takeRows<Record<string, unknown>>(
    "events",
    await sb
      .from("behavioural_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(200),
  );
  const crmRows = takeRows<Record<string, unknown>>(
    "crm_sync",
    await sb
      .from("crm_sync_attempts")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50),
  );
  return {
    case: c,
    reservation: r,
    messages: msgRows.map(mapMessage) as MessageRow[],
    events: evRows.map(mapBehaviouralEvent) as BehaviouralEventRow[],
    crmSync: crmRows.map(mapCrmSyncAttempt) as CrmSyncAttemptRow[],
  };
}

export async function getQualityStats() {
  const sb = serviceSupabase();
  const countHead = async (
    label: string,
    promise: PromiseLike<{ error: { message: string } | null; count: number | null }>,
  ) => {
    const { error, count } = await promise;
    if (error) throw new Error(`${label}: ${error.message}`);
    return count ?? 0;
  };
  const totalCases = await countHead(
    "count cases",
    sb.from("cases").select("*", { count: "exact", head: true }),
  );
  const enrichmentComplete = await countHead(
    "count enrichment complete",
    sb
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "complete"),
  );
  const d1Confirmed = await countHead(
    "count d1 confirmed",
    sb
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("confirmation_status", "confirmed"),
  );
  const human = await countHead(
    "count human intervention",
    sb
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("human_intervention", true),
  );
  const smsFallback = await countHead(
    "count sms fallback",
    sb
      .from("behavioural_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "fallback_sms_triggered"),
  );
  const lowConf = await countHead(
    "count low confidence",
    sb
      .from("behavioural_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "extraction_low_confidence"),
  );
  const { data: msgData, error: msgErr } = await sb
    .from("messages")
    .select("channel");
  if (msgErr) throw new Error(`messages channel: ${msgErr.message}`);
  const byChannelMap = new Map<string, number>();
  for (const row of msgData ?? []) {
    const ch = String((row as { channel: string }).channel);
    byChannelMap.set(ch, (byChannelMap.get(ch) ?? 0) + 1);
  }
  const messagesByChannel = [...byChannelMap.entries()].map(
    ([channel, n]) => ({ channel, n }),
  );
  return {
    totalCases,
    enrichmentComplete,
    d1Confirmed,
    humanIntervention: human,
    smsFallbackEvents: smsFallback,
    lowConfidenceEvents: lowConf,
    messagesByChannel,
  };
}
