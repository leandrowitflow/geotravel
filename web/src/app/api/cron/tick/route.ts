import { NextResponse } from "next/server";
import {
  processD1Confirmations,
  processOutreachQueue,
  processRetries,
} from "@/lib/orchestration/process-outreach-and-d1";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const outreach = await processOutreachQueue();
  const d1 = await processD1Confirmations();
  const retries = await processRetries();
  return NextResponse.json({
    ok: true,
    outreach: outreach.processed,
    d1: d1.processed,
    retries: retries.bumped,
  });
}
