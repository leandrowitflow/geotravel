import type { CollectedDataJson, ConsentJson } from "@/db/schema";
import {
  EXTRA_ITEM_LABELS,
  isExtraItem,
} from "@/lib/contracts/extras-items";
import { normalizeLegacyCollectedData } from "@/lib/orchestration/collected-data-merge";

export type CollectedDataDisplayRow = {
  key: string;
  label: string;
  value: string;
  lowConfidence?: boolean;
};

function formatCount(
  count: number | null | undefined,
  notes: string | null | undefined,
): string {
  if (count != null && notes?.trim()) {
    return `${count} — ${notes.trim()}`;
  }
  if (count != null) return String(count);
  if (notes?.trim()) return notes.trim();
  return "—";
}

function formatExtras(data: CollectedDataJson): string {
  if (data.extras_none_confirmed) return "None";
  const items = data.extras_items ?? [];
  if (items.length === 0 && data.extras_notes?.trim()) {
    return data.extras_notes.trim();
  }
  const labels = items.map((x) =>
    isExtraItem(x) ? EXTRA_ITEM_LABELS[x] : x,
  );
  const line = labels.join(", ");
  if (data.extras_notes?.trim()) {
    return labels.length ? `${line}; ${data.extras_notes.trim()}` : data.extras_notes.trim();
  }
  return line || "—";
}

function confidence(
  data: CollectedDataJson,
  field: string,
): boolean | undefined {
  const c = data.collection_confidence?.[field];
  if (c == null) return undefined;
  return c < 0.5;
}

/** One-line summary for case inbox table ("Extra information" column). */
export function formatExtraInformationSummary(
  raw: CollectedDataJson | null | undefined,
  maxLen = 140,
): string {
  const rows = buildCollectedDataDisplayRows(raw);
  if (rows.length === 0) return "—";
  const line = rows.map((r) => `${r.label}: ${r.value}`).join(" · ");
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

export function buildCollectedDataDisplayRows(
  raw: CollectedDataJson | null | undefined,
): CollectedDataDisplayRow[] {
  const data = normalizeLegacyCollectedData(raw);
  const rows: CollectedDataDisplayRow[] = [];

  const push = (
    key: string,
    label: string,
    value: string,
    confField?: string,
  ) => {
    if (value === "—") return;
    rows.push({
      key,
      label,
      value,
      lowConfidence: confField ? confidence(data, confField) : undefined,
    });
  };

  push(
    "passenger_count_actual",
    "Number of passengers",
    data.passenger_count_actual != null
      ? String(data.passenger_count_actual)
      : "—",
    "passenger_count_actual",
  );

  if (data.children_count != null) {
    const ages =
      data.child_ages?.length ?
        ` (ages: ${data.child_ages.join(", ")})`
      : "";
    push(
      "children_count",
      "Children",
      `${data.children_count}${ages}`,
      "children_count",
    );
  }

  push(
    "cabin_luggage",
    "Cabin luggage",
    formatCount(data.cabin_luggage_pieces, data.cabin_luggage_notes),
    "cabin_luggage_pieces",
  );

  push(
    "checked_luggage",
    "Checked luggage",
    formatCount(data.checked_luggage_pieces, data.checked_luggage_notes),
    "checked_luggage_pieces",
  );

  const extrasVal = formatExtras(data);
  if (
    data.extras_none_confirmed ||
    (data.extras_items != null && data.extras_items.length > 0) ||
    data.extras_notes?.trim()
  ) {
    push("extras", "Any extras?", extrasVal, "extras_items");
  }

  if (data.reduced_mobility_present != null) {
    const mob =
      data.reduced_mobility_present ?
        data.reduced_mobility_notes?.trim() || "Yes"
      : "No";
    push("reduced_mobility", "Reduced mobility", mob, "reduced_mobility_present");
  }

  if (data.additional_notes?.trim()) {
    push(
      "additional_notes",
      "Additional notes",
      data.additional_notes.trim(),
      "additional_notes",
    );
  }

  return rows;
}

export type ConsentDisplayRow = {
  label: string;
  value: string;
};

export function buildConsentDisplayRows(
  consent: ConsentJson | null | undefined,
): ConsentDisplayRow[] {
  const c = consent ?? {};
  const yesNo = (v: boolean | undefined) =>
    v === true ? "Yes" : v === false ? "No" : "—";

  return [
    {
      label: "Future marketing (WhatsApp/SMS)",
      value: yesNo(c.consent_future_marketing),
    },
    {
      label: "Return transfer reminders",
      value: yesNo(c.consent_return_transfer_reminders),
    },
    { label: "Partner offers", value: yesNo(c.consent_partner_offers) },
    {
      label: "Operational basis",
      value: yesNo(c.consent_operational_basis),
    },
    {
      label: "Captured at",
      value: c.consent_captured_at?.trim() || "—",
    },
  ].filter((r) => r.value !== "—");
}
