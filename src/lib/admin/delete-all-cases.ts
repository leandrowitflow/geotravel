import { assertNoError } from "@/db/supabase-helpers";
import { serviceSupabase } from "@/lib/supabase/service-role";

/** Deletes all rows from `cases` (messages and crm_sync_attempts cascade). Reservations stay. */
export async function deleteAllCases(): Promise<{ deleted: number }> {
  const sb = serviceSupabase();
  const res = await sb
    .from("cases")
    .delete({ count: "exact" })
    .not("id", "is", null);
  assertNoError("delete all cases", res);
  return { deleted: res.count ?? 0 };
}
