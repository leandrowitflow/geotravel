import type { CollectedDataJson, ConsentJson } from "@/db/schema";
import {
  buildCollectedDataDisplayRows,
  buildConsentDisplayRows,
} from "@/lib/admin/collected-data-display";

function DataGrid({
  rows,
  emptyLabel,
}: {
  rows: { label: string; value: string; lowConfidence?: boolean }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">{emptyLabel}</p>
    );
  }
  return (
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-md border border-stone-100 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/50"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {row.label}
          </dt>
          <dd
            className={`mt-1 text-sm text-stone-900 dark:text-stone-100 ${
              row.lowConfidence ?
                "rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 dark:border-amber-800 dark:bg-amber-950/40"
              : ""
            }`}
          >
            {row.value}
            {row.lowConfidence ? (
              <span className="ml-1 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                (low confidence)
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CollectedDataConsentPanel({
  collectedData,
  consent,
}: {
  collectedData: CollectedDataJson | null | undefined;
  consent: ConsentJson | null | undefined;
}) {
  const dataRows = buildCollectedDataDisplayRows(collectedData);
  const consentRows = buildConsentDisplayRows(consent);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
      <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">
        Collected data &amp; consent
      </h2>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Parsed from customer WhatsApp messages (updates as they reply).
      </p>

      <h3 className="mt-4 text-sm font-semibold text-stone-800 dark:text-stone-200">
        Trip details from messages
      </h3>
      <DataGrid
        rows={dataRows}
        emptyLabel="No structured data extracted yet — waiting for customer replies."
      />

      <h3 className="mt-6 text-sm font-semibold text-stone-800 dark:text-stone-200">
        Consent
      </h3>
      <DataGrid
        rows={consentRows}
        emptyLabel="No consent recorded yet."
      />

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-stone-500 dark:text-stone-400">
          Raw JSON (debug)
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-stone-50 p-2 text-[10px] dark:bg-stone-950">
          {JSON.stringify({ collectedData: collectedData ?? {}, consent: consent ?? {} }, null, 2)}
        </pre>
      </details>
    </section>
  );
}
