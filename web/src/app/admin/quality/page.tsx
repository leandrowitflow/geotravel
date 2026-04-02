import { getQualityStats } from "@/lib/admin/queries";

export default async function QualityPage() {
  const s = await getQualityStats();
  const denom = Math.max(s.totalCases, 1);
  const enrichRate = Math.round((s.enrichmentComplete / denom) * 100);
  const d1Rate = Math.round((s.d1Confirmed / denom) * 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Quality & consumption
        </h1>
        <p className="text-sm text-stone-600">
          Core KPIs from cases and behavioural events (MVP).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Total cases</p>
          <p className="text-3xl font-semibold text-stone-900">{s.totalCases}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Enrichment complete</p>
          <p className="text-3xl font-semibold text-teal-900">
            {s.enrichmentComplete}{" "}
            <span className="text-lg text-stone-500">({enrichRate}%)</span>
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">D-1 confirmed</p>
          <p className="text-3xl font-semibold text-teal-900">
            {s.d1Confirmed}{" "}
            <span className="text-lg text-stone-500">({d1Rate}%)</span>
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Human intervention</p>
          <p className="text-3xl font-semibold text-amber-900">
            {s.humanIntervention}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">SMS fallback events</p>
          <p className="text-3xl font-semibold text-stone-900">
            {s.smsFallbackEvents}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-stone-500">Low-confidence extractions</p>
          <p className="text-3xl font-semibold text-stone-900">
            {s.lowConfidenceEvents}
          </p>
        </div>
      </div>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Messages by channel</h2>
        <ul className="mt-2 space-y-1 text-sm">
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
