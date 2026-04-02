import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { cases, contacts, messages, reservations } from "@/db/schema";
import { requireStaff } from "@/lib/auth/require-staff";
import { buildCrmEnrichmentPayload } from "@/lib/crm/enrichment-payload";
import { syncEnrichmentToCrm } from "@/lib/crm/sync-with-retry";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import type { CollectedDataJson } from "@/db/schema";

const bodySchema = z.object({
  action: z.enum([
    "resend",
    "force_sms",
    "retry_crm",
    "needs_human",
    "close_case",
  ]),
});

function normalizeToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireStaff();
  const { id: caseId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [resv] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, row.reservationId))
    .limit(1);
  if (!resv) {
    return NextResponse.json({ error: "reservation_missing" }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "force_sms": {
      await db
        .update(cases)
        .set({ currentChannel: "sms", updatedAt: new Date() })
        .where(eq(cases.id, caseId));
      await writeBehaviouralEvent({
        eventType: "fallback_sms_triggered",
        caseId,
        reservationId: resv.id,
        channel: "sms",
        payload: { source: "admin_force" },
      });
      break;
    }
    case "needs_human": {
      await db
        .update(cases)
        .set({
          humanIntervention: true,
          orchestrationState: "needs_human",
          exceptionFlag: true,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));
      await writeBehaviouralEvent({
        eventType: "human_intervention_requested",
        caseId,
        reservationId: resv.id,
      });
      break;
    }
    case "close_case": {
      await db
        .update(cases)
        .set({
          caseStatus: "closed",
          orchestrationState: "closed",
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cases.id, caseId));
      await writeBehaviouralEvent({
        eventType: "case_closed",
        caseId,
        reservationId: resv.id,
        payload: { source: "admin" },
      });
      break;
    }
    case "retry_crm": {
      const data = (row.collectedData ?? {}) as CollectedDataJson;
      const payload = buildCrmEnrichmentPayload(resv, data);
      await syncEnrichmentToCrm({
        caseId,
        reservationId: resv.id,
        payload,
      });
      break;
    }
    case "resend": {
      const cont = await db
        .select()
        .from(contacts)
        .where(eq(contacts.reservationId, resv.id))
        .orderBy(desc(contacts.createdAt))
        .limit(1);
      const to = normalizeToE164(cont[0]?.phone ?? resv.sourcePhone);
      if (!to) {
        return NextResponse.json({ error: "no_phone" }, { status: 400 });
      }
      const body = `Geotravel reminder (ref ${resv.externalBookingId}): please reply to complete your transfer details.`;
      const send = await sendViaPreferredChannel({
        caseId,
        reservationId: resv.id,
        preferred: row.currentChannel as "whatsapp" | "sms",
        toE164: to,
        body,
      });
      if (send.ok) {
        await db.insert(messages).values({
          caseId,
          direction: "outbound",
          channel: send.channel,
          body,
          providerMessageId: send.providerMessageId,
          status: "sent",
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
