import { after, NextResponse } from "next/server";
import { isInfobipSmsConfigured } from "@/lib/messaging/infobip-config";
import {
  describeInfobipInboundPayload,
  parseInfobipInboundSmsPayload,
} from "@/lib/messaging/parse-infobip-inbound-sms";
import { processInboundMessaging } from "@/lib/orchestration/process-inbound-message";

/**
 * Infobip inbound SMS (MO). No extra product — pay per MO segment.
 *
 * Option A (number override): Channels and Numbers → +351923250271 → SMS →
 * Forward to HTTP → POST MO_JSON_2 → this URL.
 *
 * Option B (subscription): Developer Tools → Subscriptions Management →
 * INBOUND_MESSAGE + SMS + MO_JSON_2 → notification profile webhook = this URL;
 * number default must be Follow subscription and match that subscription.
 */
export const maxDuration = 60;

function productionReadiness() {
  return {
    infobipSms: isInfobipSmsConfigured(),
    supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

export async function GET() {
  const ready = productionReadiness();
  const allReady = ready.infobipSms && ready.supabase && ready.openai;
  return NextResponse.json({
    ok: true,
    service: "geotravel-infobip-inbound-sms",
    hint: "Configure MO forward to this URL (POST, MO_JSON_2).",
    ready: allReady,
    config: ready,
    ...(allReady
      ? {}
      : {
          warning:
            "Missing Vercel env vars — inbound may save but assistant SMS replies will not send.",
        }),
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    console.warn("[infobip sms webhook] invalid_json", {
      contentType: req.headers.get("content-type"),
      excerpt: raw.slice(0, 200),
    });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = parseInfobipInboundSmsPayload(payload);
  if (messages.length === 0) {
    console.warn(
      "[infobip sms webhook] no parseable inbound messages;",
      describeInfobipInboundPayload(payload),
    );
    return NextResponse.json({ ok: true, processed: 0, parsed: 0, replies: 0 });
  }

  const runInbound = async () => {
    let processed = 0;
    let replies = 0;
    for (const msg of messages) {
      try {
        const result = await processInboundMessaging({
          channel: "sms",
          fromE164: msg.fromE164,
          body: msg.body,
          providerMessageId: msg.providerMessageId,
        });
        if (!result.ok) {
          console.warn("[infobip sms webhook] pipeline:", result.error, {
            from: msg.fromE164,
            to: msg.toDigits,
          });
        } else {
          processed += 1;
          if (result.replied) replies += 1;
          console.info("[infobip sms webhook] processed inbound", {
            from: msg.fromE164,
            to: msg.toDigits,
            replied: result.replied,
            excerpt: msg.body.slice(0, 80),
          });
          if (!result.replied) {
            console.warn(
              "[infobip sms webhook] processed but no outbound SMS sent — check Vercel env (INFOBIP_*, OPENAI_API_KEY) or /admin/cases",
              { from: msg.fromE164, config: productionReadiness() },
            );
          }
        }
      } catch (e) {
        console.error("[infobip sms webhook] processInboundMessaging failed:", e);
      }
    }
    return { processed, replies };
  };

  const awaitEnv = process.env.INFOBIP_WEBHOOK_AWAIT_PROCESSING?.trim().toLowerCase();
  const awaitProcessing = awaitEnv !== "false";
  const stats = awaitProcessing
    ? await runInbound()
    : (after(runInbound), { processed: 0, replies: 0 });

  return NextResponse.json({
    ok: true,
    processed: stats.processed,
    replies: stats.replies,
    received: messages.length,
    awaited: awaitProcessing,
    config: productionReadiness(),
  });
}
