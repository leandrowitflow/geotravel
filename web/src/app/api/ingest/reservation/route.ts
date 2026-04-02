import { NextResponse } from "next/server";
import { reservationIngestEventSchema } from "@/lib/contracts/ingest";
import { ingestReservationEvent } from "@/lib/services/ingest-reservation";

export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = reservationIngestEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const result = await ingestReservationEvent(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    reservation_id: result.reservationId,
    case_id: result.caseId,
  });
}
