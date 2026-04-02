import { getDb } from "@/db";
import { behaviouralEvents } from "@/db/schema";
import type { BehaviouralEventType } from "@/lib/contracts/events";

export async function writeBehaviouralEvent(input: {
  eventType: BehaviouralEventType;
  caseId?: string | null;
  reservationId?: string | null;
  channel?: string | null;
  payload?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(behaviouralEvents).values({
    eventType: input.eventType,
    caseId: input.caseId ?? null,
    reservationId: input.reservationId ?? null,
    channel: input.channel ?? null,
    payload: input.payload ?? {},
  });
}
