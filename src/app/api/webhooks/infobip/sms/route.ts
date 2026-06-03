import { after, NextResponse } from "next/server";
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
 *
 * If the number is Follow subscription with no subscription, MO appears in logs only.
 */
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "geotravel-infobip-inbound-sms",
    hint: "Configure MO forward to this URL (POST, MO_JSON_2).",
  });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    console.warn("[infobip sms webhook] invalid_json");
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = parseInfobipInboundSmsPayload(payload);
  if (messages.length === 0) {
    console.warn(
      "[infobip sms webhook] no parseable inbound messages;",
      describeInfobipInboundPayload(payload),
    );
    return NextResponse.json({ ok: true, processed: 0, parsed: 0 });
  }

  const runInbound = async () => {
    let processed = 0;
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
          console.info("[infobip sms webhook] processed inbound", {
            from: msg.fromE164,
            to: msg.toDigits,
            excerpt: msg.body.slice(0, 80),
          });
        }
      } catch (e) {
        console.error("[infobip sms webhook] processInboundMessaging failed:", e);
      }
    }
    return processed;
  };

  const awaitEnv = process.env.INFOBIP_WEBHOOK_AWAIT_PROCESSING?.trim().toLowerCase();
  /** Default on: AI reply must finish before handler returns (same as WhatsApp). */
  const awaitProcessing = awaitEnv !== "false";
  const processed = awaitProcessing ? await runInbound() : (after(runInbound), 0);

  return NextResponse.json({
    ok: true,
    processed,
    received: messages.length,
    awaited: awaitProcessing,
  });
}
