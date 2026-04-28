import { NextResponse } from "next/server";
import { z } from "zod";
import { mapCase, mapReservation } from "@/db/map-supabase";
import type { CollectedDataJson } from "@/db/schema";
import { assertNoError, takeRows } from "@/db/supabase-helpers";
import { requireStaff } from "@/lib/auth/require-staff";
import { buildCrmEnrichmentPayload } from "@/lib/crm/enrichment-payload";
import { syncEnrichmentToCrm } from "@/lib/crm/sync-with-retry";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { sendViaPreferredChannel } from "@/lib/messaging/send-via-channel";
import { serviceSupabase } from "@/lib/supabase/service-role";

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
  const sb = serviceSupabase();
  const caseRes = await sb.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (caseRes.error) {
    return NextResponse.json({ error: caseRes.error.message }, { status: 500 });
  }
  if (!caseRes.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const row = mapCase(caseRes.data as Record<string, unknown>);

  const resvRes = await sb
    .from("reservations")
    .select("*")
    .eq("id", row.reservationId)
    .maybeSingle();
  if (resvRes.error) {
    return NextResponse.json({ error: resvRes.error.message }, { status: 500 });
  }
  if (!resvRes.data) {
    return NextResponse.json({ error: "reservation_missing" }, { status: 400 });
  }
  const resv = mapReservation(resvRes.data as Record<string, unknown>);

  switch (parsed.data.action) {
    case "force_sms": {
      assertNoError(
        "admin force sms",
        await sb
          .from("cases")
          .update({
            current_channel: "sms",
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId),
      );
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
      assertNoError(
        "admin needs human",
        await sb
          .from("cases")
          .update({
            human_intervention: true,
            orchestration_state: "needs_human",
            exception_flag: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId),
      );
      await writeBehaviouralEvent({
        eventType: "human_intervention_requested",
        caseId,
        reservationId: resv.id,
      });
      break;
    }
    case "close_case": {
      assertNoError(
        "admin close case",
        await sb
          .from("cases")
          .update({
            case_status: "closed",
            orchestration_state: "closed",
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId),
      );
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
      const contRows = takeRows<Record<string, unknown>>(
        "admin contact",
        await sb
          .from("contacts")
          .select("*")
          .eq("reservation_id", resv.id)
          .order("created_at", { ascending: false })
          .limit(1),
      );
      const to = normalizeToE164(
        (contRows[0]?.phone as string) ?? resv.sourcePhone,
      );
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
      if (!send.ok) {
        return NextResponse.json(
          {
            error: send.error,
            hint:
              send.error === "whatsapp_not_configured"
                ? "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local."
                : row.currentChannel === "whatsapp"
                  ? "WhatsApp often rejects free-form text outside the 24h customer window; use a template or have the customer message you first."
                  : undefined,
          },
          { status: 502 },
        );
      }
      assertNoError(
        "admin resend message",
        await sb.from("messages").insert({
          case_id: caseId,
          direction: "outbound",
          channel: send.channel,
          body,
          provider_message_id: send.providerMessageId,
          status: "sent",
        }),
      );
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
