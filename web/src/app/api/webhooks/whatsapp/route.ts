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

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (process.env.WHATSAPP_APP_SECRET && !verifyMetaSignature(raw, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const p = payload as {
    entry?: {
      changes?: {
        value?: {
          messages?: { from?: string; id?: string; text?: { body?: string } }[];
        };
      }[];
    }[];
  };
  const msg = p.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg?.from || !msg.text?.body) {
    return NextResponse.json({ ok: true });
  }
  const from = msg.from.startsWith("+") ? msg.from : `+${msg.from}`;
  await processInboundMessaging({
    channel: "whatsapp",
    fromE164: from,
    body: msg.text.body,
    providerMessageId: msg.id,
  });
  return NextResponse.json({ ok: true });
}
