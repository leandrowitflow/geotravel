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

export type CaseWithReservationAndLastMessage = {
  case: CaseRow;
  reservation: ReservationRow;
  lastMessage: MessageRow | null;
  messageCount: number;
};

export async function listCasesWithReservation(): Promise<
  CaseWithReservationAndLastMessage[]
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

  const caseIds = caseRows.map((c) => String(c.id));
  const lastByCaseId = new Map<string, MessageRow>();
  const messageCountByCaseId = new Map<string, number>();
  if (caseIds.length > 0) {
    const cap = Math.min(caseIds.length * 10, 1000);
    const msgRaw = takeRows<Record<string, unknown>>(
      "recent messages for case list",
      await sb
        .from("messages")
        .select("*")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false })
        .limit(cap),
    );
    for (const row of msgRaw) {
      const cid = String(row.case_id);
      if (!lastByCaseId.has(cid)) {
        lastByCaseId.set(cid, mapMessage(row) as MessageRow);
      }
    }

    const countRows = takeRows<{ case_id: string }>(
      "message counts for case list",
      await sb.from("messages").select("case_id").in("case_id", caseIds),
    );
    for (const row of countRows) {
      const cid = String(row.case_id);
      messageCountByCaseId.set(cid, (messageCountByCaseId.get(cid) ?? 0) + 1);
    }
  }

  const out: CaseWithReservationAndLastMessage[] = [];
  for (const c of caseRows) {
    const res = byId.get(String(c.reservation_id));
    if (res) {
      const mapped = mapCase(c);
      const cid = String(c.id);
      out.push({
        case: mapped,
        reservation: res,
        lastMessage: lastByCaseId.get(cid) ?? null,
        messageCount: messageCountByCaseId.get(cid) ?? 0,
      });
    }
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
      .order("created_at", { ascending: true })
      .limit(200),
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
  const { data: msgData, error: msgErr } = await sb
    .from("messages")
    .select("channel, direction, case_id");
  if (msgErr) throw new Error(`messages: ${msgErr.message}`);

  let outboundMessages = 0;
  let messagesViaWhatsapp = 0;
  let messagesViaSms = 0;
  const contactedCases = new Set<string>();
  const repliedCases = new Set<string>();
  const casesWithWaOutbound = new Set<string>();
  const casesWithSmsOutbound = new Set<string>();

  for (const row of msgData ?? []) {
    const r = row as { channel: string; direction: string; case_id: string };
    const ch = String(r.channel).toLowerCase();
    if (r.direction === "inbound") {
      repliedCases.add(r.case_id);
      continue;
    }
    if (r.direction !== "outbound") continue;

    outboundMessages++;
    contactedCases.add(r.case_id);
    if (ch === "whatsapp") {
      messagesViaWhatsapp++;
      casesWithWaOutbound.add(r.case_id);
    } else if (ch === "sms") {
      messagesViaSms++;
      casesWithSmsOutbound.add(r.case_id);
    }
  }

  const clientsContacted = contactedCases.size;

  let clientsBothChannels = 0;
  for (const id of casesWithWaOutbound) {
    if (casesWithSmsOutbound.has(id)) clientsBothChannels++;
  }
  const clientsWhatsappOnly = casesWithWaOutbound.size - clientsBothChannels;
  const clientsSmsOnly = casesWithSmsOutbound.size - clientsBothChannels;
  const clientsWaOrSms = clientsWhatsappOnly + clientsSmsOnly + clientsBothChannels;
  const clientsOtherOutbound = Math.max(0, clientsContacted - clientsWaOrSms);

  return {
    outboundMessages,
    messagesViaWhatsapp,
    messagesViaSms,
    clientsContacted,
    clientsReplied: repliedCases.size,
    /** Disjoint partition of contacted clients (sums to clientsContacted). */
    channelClientMix: {
      whatsappOnly: clientsWhatsappOnly,
      smsOnly: clientsSmsOnly,
      both: clientsBothChannels,
      otherOutbound: clientsOtherOutbound,
    },
  };
}
