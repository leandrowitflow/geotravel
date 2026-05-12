import { NextResponse } from "next/server";
import { deleteAllCases } from "@/lib/admin/delete-all-cases";
import { requireStaff } from "@/lib/auth/require-staff";

export async function POST() {
  await requireStaff();
  try {
    const { deleted } = await deleteAllCases();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "delete_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
