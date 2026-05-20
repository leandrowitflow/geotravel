import type { ExtractionResult } from "@/lib/contracts/extraction";
import { EXTRA_ITEM_VALUES, isExtraItem } from "@/lib/contracts/extras-items";
import type { CollectedDataJson } from "@/db/schema";

function unionExtras(
  prior: string[] | null | undefined,
  next: string[] | null | undefined,
): string[] | undefined {
  const set = new Set<string>();
  for (const x of prior ?? []) {
    if (isExtraItem(x) || x.trim()) set.add(x);
  }
  for (const x of next ?? []) {
    if (isExtraItem(x) || x.trim()) set.add(x);
  }
  if (set.size === 0) return undefined;
  return [...set];
}

/** Merge AI extraction into case collected_data (arrays union, keep lifecycle flags). */
export function mergeCollectedData(
  prior: CollectedDataJson | null | undefined,
  next: ExtractionResult,
): CollectedDataJson {
  const base: CollectedDataJson = { ...(prior ?? {}) };

  for (const [k, v] of Object.entries(next)) {
    if (k === "confidence") continue;
    if (v === undefined || v === null) continue;

    if (k === "extras_items") {
      const merged = unionExtras(base.extras_items, v as string[]);
      if (merged) base.extras_items = merged;
      continue;
    }
    if (k === "child_ages" && Array.isArray(v)) {
      base.child_ages = v as number[];
      continue;
    }
    (base as Record<string, unknown>)[k] = v;
  }

  if (next.confidence) {
    base.collection_confidence = {
      ...(base.collection_confidence ?? {}),
      ...next.confidence,
    };
  }

  if (base.extras_items?.length) {
    base.special_luggage_present = true;
    base.special_luggage_types = base.extras_items;
    if (base.extras_items.includes("pushchair")) {
      base.baby_stroller_present = true;
    }
    if (base.extras_items.includes("baby_seat")) {
      base.child_seat_needed = true;
    }
  } else if (base.extras_none_confirmed === true) {
    base.special_luggage_present = false;
    base.extras_items = [];
  }

  return base;
}

export function normalizeLegacyCollectedData(
  data: CollectedDataJson | null | undefined,
): CollectedDataJson {
  const d: CollectedDataJson = { ...(data ?? {}) };
  if (
    (!d.extras_items || d.extras_items.length === 0) &&
    d.special_luggage_types?.length
  ) {
    d.extras_items = d.special_luggage_types.filter((x) =>
      (EXTRA_ITEM_VALUES as readonly string[]).includes(x),
    );
  }
  if (d.special_luggage_present === false && d.extras_none_confirmed !== true) {
    d.extras_none_confirmed = true;
    d.extras_items = [];
  }
  return d;
}
