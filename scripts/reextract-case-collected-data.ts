/**
 * Re-run AI + heuristic extraction from the latest inbound message on a case.
 * Usage: npx tsx scripts/reextract-case-collected-data.ts <case-id>
 * Example: npx tsx scripts/reextract-case-collected-data.ts 4666f163-20d7-474a-9be5-8dfdb2665fe3
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { mapCase } from "@/db/map-supabase";
import { takeRows } from "@/db/supabase-helpers";
import { buildCollectedDataDisplayRows } from "@/lib/admin/collected-data-display";
import { applyInboundExtractionToCase } from "@/lib/orchestration/apply-inbound-extraction";
import { resolveOpenAiModelId } from "@/lib/ai/openai-client";
import { serviceSupabase } from "@/lib/supabase/service-role";

async function main() {
  const caseId = process.argv[2]?.trim();
  if (!caseId) {
    console.error(
      "Usage: npx tsx scripts/reextract-case-collected-data.ts <case-id>",
    );
    process.exit(1);
  }

  const sb = serviceSupabase();
  const caseRes = await sb.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (caseRes.error || !caseRes.data) {
    console.error("Case not found:", caseRes.error?.message ?? caseId);
    process.exit(1);
  }
  const caseRow = mapCase(caseRes.data as Record<string, unknown>);

  const inbound = takeRows<{ body: string; created_at: string }>(
    "last inbound",
    await sb
      .from("messages")
      .select("body,created_at")
      .eq("case_id", caseId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const msg = inbound[0];
  if (!msg?.body) {
    console.error("No inbound messages on this case — nothing to extract.");
    process.exit(1);
  }

  console.log("Case:", caseId);
  console.log("Reservation:", caseRow.reservationId);
  console.log("OpenAI model:", resolveOpenAiModelId());
  console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "set" : "MISSING");
  console.log("\nLast inbound message:");
  console.log(msg.body);
  console.log("\nPrior collected_data:", JSON.stringify(caseRow.collectedData ?? {}, null, 2));

  const merged = await applyInboundExtractionToCase({
    caseId,
    reservationId: caseRow.reservationId,
    customerMessage: msg.body,
    collectedData: caseRow.collectedData,
  });

  console.log("\nUpdated collected_data (cases.collected_data JSONB):");
  console.log(JSON.stringify(merged, null, 2));
  console.log("\nAdmin display rows:");
  for (const row of buildCollectedDataDisplayRows(merged)) {
    console.log(`  ${row.label}: ${row.value}`);
  }
  console.log(
    `\nView: /admin/cases/${caseId} (Collected data & consent section)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
