import { assertNoError } from "@/db/supabase-helpers";
import type { CaseRow, CollectedDataJson } from "@/db/schema";
import { extractOperationalFields } from "@/lib/ai/pipeline";
import {
  mergeCollectedData,
  normalizeLegacyCollectedData,
} from "@/lib/orchestration/collected-data-merge";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { serviceSupabase } from "@/lib/supabase/service-role";

/**
 * Parse the latest customer WhatsApp/SMS into case collected_data (passengers, luggage, extras).
 */
export async function applyInboundExtractionToCase(input: {
  caseId: string;
  reservationId: string;
  customerMessage: string;
  collectedData: CollectedDataJson | null | undefined;
}): Promise<CollectedDataJson> {
  const prior = normalizeLegacyCollectedData(input.collectedData);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return prior;
  }

  let extraction: Awaited<ReturnType<typeof extractOperationalFields>>;
  try {
    extraction = await extractOperationalFields({
      customerMessage: input.customerMessage,
      prior: prior as Record<string, unknown>,
    });
  } catch (e) {
    console.warn("[applyInboundExtraction] extractOperationalFields failed:", e);
    return prior;
  }

  const merged = normalizeLegacyCollectedData(
    mergeCollectedData(prior, extraction),
  );

  const changed = JSON.stringify(merged) !== JSON.stringify(prior);
  if (!changed) {
    return prior;
  }

  assertNoError(
    "case collected_data from inbound extraction",
    await serviceSupabase()
      .from("cases")
      .update({
        collected_data: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.caseId),
  );

  const confVals = extraction.confidence
    ? Object.values(extraction.confidence)
    : [];
  if (confVals.some((c) => c < 0.5)) {
    await writeBehaviouralEvent({
      eventType: "extraction_low_confidence",
      caseId: input.caseId,
      reservationId: input.reservationId,
    });
  }

  await writeBehaviouralEvent({
    eventType: "collected_data_updated",
    caseId: input.caseId,
    reservationId: input.reservationId,
    payload: { fields: Object.keys(extraction).filter((k) => k !== "confidence") },
  });

  return merged;
}

export async function applyInboundExtractionToCaseRow(
  caseRow: CaseRow,
  reservationId: string,
  customerMessage: string,
): Promise<CaseRow> {
  const merged = await applyInboundExtractionToCase({
    caseId: caseRow.id,
    reservationId,
    customerMessage,
    collectedData: caseRow.collectedData,
  });
  return { ...caseRow, collectedData: merged };
}
