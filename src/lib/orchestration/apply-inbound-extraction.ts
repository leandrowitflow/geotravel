import { assertNoError } from "@/db/supabase-helpers";
import type { CaseRow, CollectedDataJson } from "@/db/schema";
import {
  extractOperationalFieldsHeuristic,
  fillOperationalGapsFromHeuristic,
} from "@/lib/ai/operational-extraction-heuristic";
import { extractOperationalFields } from "@/lib/ai/pipeline";
import type { ExtractionResult } from "@/lib/contracts/extraction";
import {
  mergeCollectedData,
  normalizeLegacyCollectedData,
} from "@/lib/orchestration/collected-data-merge";
import { writeBehaviouralEvent } from "@/lib/events/write-behavioural-event";
import { serviceSupabase } from "@/lib/supabase/service-role";

/** When adults/passengers are known but children were not mentioned, assume zero children. */
export function inferChildrenCountWhenUnmentioned(
  merged: CollectedDataJson,
  customerMessage: string,
): CollectedDataJson {
  if (merged.children_count != null) return merged;
  if (merged.passenger_count_actual == null) return merged;
  if (
    /\b(child|children|crian[cç]a|beb[eé]|baby|kid|menor|niñ[oa]s?)\b/i.test(
      customerMessage,
    )
  ) {
    return merged;
  }
  return { ...merged, children_count: 0 };
}

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
  const heuristic = extractOperationalFieldsHeuristic(input.customerMessage);

  let llm: ExtractionResult = { confidence: {} };
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (hasOpenAi) {
    try {
      llm = await extractOperationalFields({
        customerMessage: input.customerMessage,
        prior: prior as Record<string, unknown>,
      });
    } catch (e) {
      console.warn("[applyInboundExtraction] extractOperationalFields failed:", e);
    }
  } else {
    console.warn(
      "[applyInboundExtraction] OPENAI_API_KEY missing — using pattern extraction only",
    );
  }

  let merged = normalizeLegacyCollectedData(
    mergeCollectedData(mergeCollectedData(prior, heuristic), llm),
  );
  const gapFill = fillOperationalGapsFromHeuristic(
    merged as Record<string, unknown>,
    heuristic,
  );
  merged = normalizeLegacyCollectedData(mergeCollectedData(merged, gapFill));
  merged = inferChildrenCountWhenUnmentioned(merged, input.customerMessage);

  const extractionFields = new Set<string>();
  for (const layer of [heuristic, llm, gapFill]) {
    for (const k of Object.keys(layer)) {
      if (k !== "confidence" && (layer as Record<string, unknown>)[k] != null) {
        extractionFields.add(k);
      }
    }
  }

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

  const confVals = [
    ...(heuristic.confidence ? Object.values(heuristic.confidence) : []),
    ...(llm.confidence ? Object.values(llm.confidence) : []),
  ];
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
    payload: { fields: [...extractionFields] },
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
