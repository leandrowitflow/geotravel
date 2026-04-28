import { getQualityStats } from "@/lib/admin/queries";

export default async function QualityPage() {
  const s = await getQualityStats();
  const denom = Math.max(s.totalCases, 1);
  const enrichRate = Math.round((s.enrichmentComplete / denom) * 100);
  const d1Rate = Math.round((s.d1Confirmed / denom) * 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Quality & consumption
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Core KPIs from cases and behavioural events (MVP).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">Total cases</p>
          <p className="text-3xl font-semibold text-stone-900 dark:text-stone-50">
            {s.totalCases}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">Enrichment complete</p>
          <p className="text-3xl font-semibold text-teal-900 dark:text-teal-300">
            {s.enrichmentComplete}{" "}
            <span className="text-lg text-stone-500 dark:text-stone-400">({enrichRate}%)</span>
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">D-1 confirmed</p>
          <p className="text-3xl font-semibold text-teal-900 dark:text-teal-300">
            {s.d1Confirmed}{" "}
            <span className="text-lg text-stone-500 dark:text-stone-400">({d1Rate}%)</span>
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">Human intervention</p>
          <p className="text-3xl font-semibold text-amber-900 dark:text-amber-200">
            {s.humanIntervention}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">SMS fallback events</p>
          <p className="text-3xl font-semibold text-stone-900 dark:text-stone-50">
            {s.smsFallbackEvents}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
          <p className="text-sm text-stone-500 dark:text-stone-400">Low-confidence extractions</p>
          <p className="text-3xl font-semibold text-stone-900 dark:text-stone-50">
            {s.lowConfidenceEvents}
          </p>
        </div>
      </div>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-lg font-medium text-stone-900 dark:text-stone-50">
          Messages by channel
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
          {s.messagesByChannel.map((row) => (
            <li key={row.channel ?? "unknown"}>
              {row.channel ?? "unknown"}: {row.n}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
