import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/require-staff";
import { runGeotravelBookingsDeltaSync } from "@/lib/geotravel/run-bookings-delta-sync";

/**
 * Staff-only: walk the full current delta window (updated_from → now), advance cursor.
 * Same logic as the Inngest cron — does not send messages.
 */
export async function POST() {
  await requireStaff();

  const result = await runGeotravelBookingsDeltaSync();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  if (result.skipped) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: result.reason },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    updatedFrom: result.updatedFrom,
    rowsInWindow: result.rowsInWindow,
    cursorAdvancedTo: result.cursorAdvancedTo,
  });
}
