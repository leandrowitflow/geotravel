import { NextResponse } from "next/server";
import { processInboundMessaging } from "@/lib/orchestration/process-inbound-message";

export async function POST(req: Request) {
  const form = await req.formData();
  const from = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "");
  const sid = String(form.get("MessageSid") ?? "");
  if (!from || !body) {
    return new NextResponse("", { status: 200 });
  }
  await processInboundMessaging({
    channel: "sms",
    fromE164: from,
    body,
    providerMessageId: sid || undefined,
  });
  return new NextResponse("", { status: 200 });
}
