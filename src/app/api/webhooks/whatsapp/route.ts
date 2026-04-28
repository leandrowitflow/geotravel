import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processInboundMessaging } from "@/lib/orchestration/process-inbound-message";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function verifyMetaSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signature?.startsWith("sha256=")) {
    return !appSecret;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const sig = signature.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

/** First user-originated text message in the webhook (Meta can send multiple changes / non-text first). */
function extractFirstInboundUserText(payload: unknown): {
  fromE164: string;
  body: string;
  providerMessageId?: string;
} | null {
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string | number;
            id?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const fromRaw =
          m.from != null && m.from !== "" ? String(m.from).trim() : "";
        const body = m.text?.body?.trim();
        if (!fromRaw || !body) continue;
        if (m.type && m.type !== "text") continue;
        const digits = fromRaw.replace(/\D/g, "");
        if (digits.length < 8) continue;
        const fromE164 = `+${digits}`;
        return {
          fromE164,
          body,
          providerMessageId: m.id ? String(m.id) : undefined,
        };
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (process.env.WHATSAPP_APP_SECRET && !verifyMetaSignature(raw, sig)) {
    console.warn("[whatsapp webhook] invalid_signature (check WHATSAPP_APP_SECRET matches Meta app)");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const inbound = extractFirstInboundUserText(payload);
  if (!inbound) {
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await processInboundMessaging({
      channel: "whatsapp",
      fromE164: inbound.fromE164,
      body: inbound.body,
      providerMessageId: inbound.providerMessageId,
    });
    if (!result.ok) {
      console.warn("[whatsapp webhook] inbound not stored:", result.error, {
        fromE164: inbound.fromE164,
      });
    }
  } catch (e) {
    console.error("[whatsapp webhook] processInboundMessaging failed:", e);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
