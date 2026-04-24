import { assertNoError } from "@/db/supabase-helpers";
import type { BehaviouralEventType } from "@/lib/contracts/events";
import { serviceSupabase } from "@/lib/supabase/service-role";

export async function writeBehaviouralEvent(input: {
  eventType: BehaviouralEventType;
  caseId?: string | null;
  reservationId?: string | null;
  channel?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = serviceSupabase();
  assertNoError(
    "behavioural_events insert",
    await sb.from("behavioural_events").insert({
      event_type: input.eventType,
      case_id: input.caseId ?? null,
      reservation_id: input.reservationId ?? null,
      channel: input.channel ?? null,
      payload: input.payload ?? {},
    }),
  );
}
