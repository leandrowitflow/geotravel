import { NextResponse } from "next/server";
import {
  describeInfobipInboundPayload,
  parseInfobipInboundSmsPayload,
} from "@/lib/messaging/parse-infobip-inbound-sms";
import { processInboundMessaging } from "@/lib/orchestration/process-inbound-message";

/**
 * Infobip inbound SMS (MO). Configure on purchased number +351923250271:
 * Channels and Numbers → number → SMS → Keyword (can be empty) → Forward to HTTP
 * → POST → MO_JSON_2 → https://YOUR_APP/api/webhooks/infobip/sms
 *
 * Receiving SMS on a bought number does not need a separate product — you pay
 * per inbound MO segment (see Infobip pricing). Configuration is in the portal.
 */
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

  return NextResponse.json({
    ok: true,
    processed,
    received: messages.length,
  });
}
