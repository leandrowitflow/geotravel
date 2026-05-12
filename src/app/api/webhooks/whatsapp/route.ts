import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processInboundMessaging } from "@/lib/orchestration/process-inbound-message";

/** Inbound runs several OpenAI calls; default Vercel limit is too low and aborts before WhatsApp reply. */
export const maxDuration = 60;

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

type RawInboundMsg = {
  from?: string | number;
  id?: string;
  type?: string;
  text?: { body?: string };
  /** Template / marketing quick-reply taps (not the same shape as `interactive`). */
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

function inboundBodyFromMessage(m: RawInboundMsg): string | null {
  const fromText = m.text?.body?.trim();
  if (fromText) return fromText;
  const quickTap =
    m.button?.text?.trim() ||
    (m.button?.payload && String(m.button.payload).trim()) ||
    null;
  if (quickTap) return quickTap;
  const ir = m.interactive;
  if (!ir) return null;
  const btn = ir.button_reply?.title?.trim();
  if (btn) return btn;
  const list = ir.list_reply?.title?.trim();
  if (list) return list;
  return null;
}

/** Log when Meta sent payloads we did not turn into user text (helps debug missing replies). */
function logUnparsedWhatsAppMessages(payload: unknown) {
  const p = payload as {
    object?: string;
    entry?: Array<{ changes?: unknown[] }>;
  };
  if (p.object !== "whatsapp_business_account") return;
  const types: string[] = [];
  const fields: string[] = [];
  let statusCount = 0;
  try {
    for (const entry of p.entry ?? []) {
      for (const ch of (entry.changes ?? []) as Array<{
        field?: string;
        value?: {
          messages?: RawInboundMsg[];
          statuses?: unknown[];
        };
      }>) {
        if (ch.field) fields.push(String(ch.field));
        statusCount += ch.value?.statuses?.length ?? 0;
        for (const m of ch.value?.messages ?? []) {
          types.push(String(m.type ?? "?"));
        }
      }
    }
    if (types.length > 0) {
      console.info(
        "[whatsapp webhook] message type(s) present but no extractable user text:",
        types.join(", "),
      );
    } else if (statusCount > 0) {
      console.info(
        "[whatsapp webhook] delivery/status update only (no user messages). fields:",
        fields.join(", ") || "(none)",
        "statuses:",
        statusCount,
      );
    } else {
      console.info(
        "[whatsapp webhook] no user messages in payload. change fields:",
        fields.join(", ") || "(none)",
      );
    }
  } catch {
    /* ignore */
  }
}

/** First user-originated text (or interactive reply title) in the webhook. */
function extractFirstInboundUserText(payload: unknown): {
  fromE164: string;
  body: string;
  providerMessageId?: string;
} | null {
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: RawInboundMsg[];
        };
      }>;
    }>;
  };
  for (const entry of p.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const fromRaw =
          m.from != null && m.from !== "" ? String(m.from).trim() : "";
        const body = inboundBodyFromMessage(m);
        if (!fromRaw || !body) continue;
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
    logUnparsedWhatsAppMessages(payload);
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
