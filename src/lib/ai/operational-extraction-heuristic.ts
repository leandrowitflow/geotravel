import type {
  ExtractionFields,
  ExtractionResult,
} from "@/lib/contracts/extraction";
import type { ExtraItem } from "@/lib/contracts/extras-items";
import type { CollectedDataJson } from "@/db/schema";

const HEURISTIC_CONF = 0.88;

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1] ?? null;
}

function parseIntSafe(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Detect extras mentioned in PT/EN free text. */
function detectExtrasItems(text: string): ExtraItem[] {
  const lower = text.toLowerCase();
  const found = new Set<ExtraItem>();

  const rules: Array<{ item: ExtraItem; re: RegExp }> = [
    {
      item: "baby_seat",
      re: /cadeira\s+de\s+beb[eé]|cadeirinha|baby\s+seat|child\s+seat|silla\s+de\s+beb[eé]/i,
    },
    {
      item: "booster_seat",
      re: /assento\s+elev|booster|rehausseur|elevador/i,
    },
    { item: "bicycle", re: /\bbicicleta\b|\bbike\b|\bbicycle\b/i },
    { item: "golf_bag", re: /saco\s+de\s+golfe|golf\s+bag|bolsa\s+de\s+golfe/i },
    {
      item: "sports_equipment",
      re: /equipamento\s+desportivo|sports?\s+equipment|material\s+desportivo/i,
    },
    {
      item: "pet_box",
      re: /animal\s+de\s+estima|pet\s+box|caixa\s+.*animal|transporte\s+.*animal/i,
    },
    {
      item: "pushchair",
      re: /carrinho\s+de\s+beb[eé]|pushchair|stroller|pram/i,
    },
    { item: "wheelchair", re: /cadeira\s+de\s+rodas|wheelchair|fauteuil/i },
  ];

  for (const { item, re } of rules) {
    if (re.test(lower)) found.add(item);
  }

  if (
    /\b(nada|nenhum|sem)\s+(extra|extras|especial)/i.test(lower) ||
    /\bno\s+extras?\b/i.test(lower)
  ) {
    return [];
  }

  return [...found];
}

function detectPassengerCount(text: string): number | null {
  const patterns = [
    /(?:somos|s[aã]o|ser[aã]o|vamos\s+ser)\s+(\d{1,2})\s*(?:pessoas|passageiros|adultos)/i,
    /(?:we\s+are|there\s+are|will\s+be)\s+(\d{1,2})\s*(?:people|passengers|adults)/i,
    /(\d{1,2})\s*(?:pessoas|passageiros|people|passengers)\b/i,
    /(?:total\s+de\s+)?(\d{1,2})\s*(?:passageiros|pax)\b/i,
  ];
  for (const re of patterns) {
    const n = parseIntSafe(firstMatch(text, re));
    if (n != null && n > 0 && n <= 99) return n;
  }
  return null;
}

function detectChildrenCount(text: string): number | null {
  const patterns = [
    /(\d{1,2})\s*crian[cç]as?\b/i,
    /(\d{1,2})\s*(?:children|kids)\b/i,
    /(?:uma|um|1)\s+beb[eé]\b/i,
  ];
  for (const re of patterns) {
    const n = parseIntSafe(firstMatch(text, re));
    if (n != null && n >= 0 && n <= 20) return n;
  }
  if (/\b(sem|no)\s+crian[cç]as?\b/i.test(text)) return 0;
  return null;
}

function detectCabinLuggagePieces(text: string): number | null {
  const patterns = [
    /(\d{1,2})\s*(?:malas?\s+de\s+m[aã]o|mala\s+de\s+m[aã]o|bagagem\s+de\s+m[aã]o)/i,
    /(\d{1,2})\s*(?:hand\s+luggage|cabin\s+bags?)/i,
    /(\d{1,2})\s*(?:peças?\s+de\s+)?cabine\b/i,
  ];
  for (const re of patterns) {
    const n = parseIntSafe(firstMatch(text, re));
    if (n != null) return n;
  }
  return null;
}

function detectCheckedLuggagePieces(text: string): number | null {
  const patterns = [
    /(\d{1,2})\s*(?:malas?\s+de\s+por[aã]o|mala\s+de\s+por[aã]o|bagagem\s+de\s+por[aã]o)/i,
    /(\d{1,2})\s*(?:checked\s+(?:bags?|luggage)|hold\s+luggage)/i,
    /(\d{1,2})\s*suitcases?\b/i,
  ];
  for (const re of patterns) {
    const n = parseIntSafe(firstMatch(text, re));
    if (n != null) return n;
  }
  return null;
}

/** Generic "N malas" only when no cabin/checked-specific counts were found. */
function detectGenericMalasCount(text: string): number | null {
  if (detectCabinLuggagePieces(text) != null || detectCheckedLuggagePieces(text) != null) {
    return null;
  }
  const n = parseIntSafe(firstMatch(text, /(?:com\s+)?(\d{1,2})\s*malas?\b/i));
  if (n != null) return n;
  return parseIntSafe(firstMatch(text, /(\d{1,2})\s*(?:bags?|luggage\s+pieces?)\b/i));
}

/**
 * Fast PT/EN pattern extraction for common single-message replies (no API).
 * Merged before/after OpenAI; fills fields the model often skips in one sentence.
 */
export function extractOperationalFieldsHeuristic(
  customerMessage: string,
): ExtractionResult {
  const text = customerMessage.trim();
  if (!text) return { confidence: {} };

  const confidence: Record<string, number> = {};
  const out: ExtractionResult = { confidence };

  const passengers = detectPassengerCount(text);
  if (passengers != null) {
    out.passenger_count_actual = passengers;
    confidence.passenger_count_actual = HEURISTIC_CONF;
  }

  const children = detectChildrenCount(text);
  if (children != null) {
    out.children_count = children;
    confidence.children_count = HEURISTIC_CONF;
  }

  const cabin = detectCabinLuggagePieces(text);
  if (cabin != null) {
    out.cabin_luggage_pieces = cabin;
    confidence.cabin_luggage_pieces = HEURISTIC_CONF;
  }

  const checked = detectCheckedLuggagePieces(text);
  if (checked != null) {
    out.checked_luggage_pieces = checked;
    confidence.checked_luggage_pieces = HEURISTIC_CONF;
  }

  const genericMalas = detectGenericMalasCount(text);
  if (genericMalas != null) {
    out.checked_luggage_pieces = genericMalas;
    out.checked_luggage_notes =
      "Customer said malas/bags without cabin vs hold split";
    confidence.checked_luggage_pieces = HEURISTIC_CONF - 0.05;
  }

  const extras = detectExtrasItems(text);
  if (extras.length > 0) {
    out.extras_items = extras;
    out.extras_none_confirmed = false;
    confidence.extras_items = HEURISTIC_CONF;
  } else if (
    /\b(sem\s+extras?|nada\s+de\s+especial|no\s+extras?|nothing\s+special)\b/i.test(
      text,
    )
  ) {
    out.extras_none_confirmed = true;
    out.extras_items = [];
    confidence.extras_none_confirmed = HEURISTIC_CONF;
  }

  if (
    /\b(mobilidade\s+reduzida|wheelchair|cadeira\s+de\s+rodas|reduced\s+mobility)\b/i.test(
      text,
    )
  ) {
    out.reduced_mobility_present = true;
    confidence.reduced_mobility_present = HEURISTIC_CONF;
  } else if (/\b(sem\s+necessidades?\s+especiais)\b/i.test(text)) {
    out.reduced_mobility_present = false;
    confidence.reduced_mobility_present = HEURISTIC_CONF;
  }

  return out;
}

/** Apply heuristic values only where merged data still lacks that field. */
export function fillOperationalGapsFromHeuristic(
  merged: CollectedDataJson,
  heuristic: ExtractionResult,
): ExtractionResult {
  const patch: ExtractionResult = { confidence: {} };

  const setIfMissing = (
    key: keyof ExtractionFields,
    value: unknown,
    confKey?: string,
  ) => {
    if (value === undefined || value === null) return;
    if ((merged as Record<string, unknown>)[key] != null) return;
    (patch as Record<string, unknown>)[key] = value;
    if (heuristic.confidence?.[confKey ?? key]) {
      patch.confidence = patch.confidence ?? {};
      patch.confidence[confKey ?? key] = heuristic.confidence[confKey ?? key];
    }
  };

  setIfMissing("passenger_count_actual", heuristic.passenger_count_actual);
  setIfMissing("children_count", heuristic.children_count);
  setIfMissing("cabin_luggage_pieces", heuristic.cabin_luggage_pieces);
  setIfMissing("checked_luggage_pieces", heuristic.checked_luggage_pieces);
  setIfMissing("checked_luggage_notes", heuristic.checked_luggage_notes);
  setIfMissing("cabin_luggage_notes", heuristic.cabin_luggage_notes);

  if (
    !merged.extras_items?.length &&
    merged.extras_none_confirmed !== true &&
    heuristic.extras_items?.length
  ) {
    patch.extras_items = heuristic.extras_items;
    if (heuristic.confidence?.extras_items) {
      patch.confidence = { ...patch.confidence, extras_items: heuristic.confidence.extras_items };
    }
  }
  if (
    merged.extras_none_confirmed == null &&
    heuristic.extras_none_confirmed === true
  ) {
    patch.extras_none_confirmed = true;
    patch.extras_items = [];
  }

  if (
    merged.reduced_mobility_present == null &&
    heuristic.reduced_mobility_present != null
  ) {
    patch.reduced_mobility_present = heuristic.reduced_mobility_present;
  }

  return patch;
}
