import {
  formatUsd,
  type ConsumptionPeriodStats,
  type ConsumptionStats,
} from "@/lib/admin/consumption-queries";

function PeriodTable({
  title,
  period,
}: {
  title: string;
  period: ConsumptionPeriodStats;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h3>
        <p className="text-lg font-semibold tabular-nums text-teal-800 dark:text-teal-300">
          {formatUsd(period.totalUsd)}
          <span className="ml-1 text-sm font-normal text-stone-500 dark:text-stone-400">
            estimated
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400">
              <th className="py-2 pr-4 font-medium">Provider</th>
              <th className="py-2 pr-4 font-medium">Usage</th>
              <th className="py-2 pr-4 font-medium text-right">Events</th>
              <th className="py-2 font-medium text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {period.providers.map((p) => (
              <tr
                key={p.provider}
                className="border-b border-stone-100 last:border-0 dark:border-stone-800"
              >
                <td className="py-2.5 pr-4 font-medium text-stone-800 dark:text-stone-200">
                  {p.label}
                </td>
                <td className="py-2.5 pr-4 text-stone-600 dark:text-stone-400">
                  {p.provider === "openai" ? (
                    <>
                      <span className="tabular-nums">
                        {Math.round(p.quantity).toLocaleString()}
                      </span>{" "}
                      {p.quantityLabel}
                      {(p.inputTokens > 0 || p.outputTokens > 0) && (
                        <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-500">
                          {p.inputTokens.toLocaleString()} in ·{" "}
                          {p.outputTokens.toLocaleString()} out
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        {Math.round(p.quantity).toLocaleString()}
                      </span>{" "}
                      {p.quantityLabel}
                    </>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-stone-600 dark:text-stone-400">
                  {p.eventCount.toLocaleString()}
                </td>
                <td className="py-2.5 text-right tabular-nums text-stone-800 dark:text-stone-200">
                  {formatUsd(p.estimatedCostUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QualityConsumptionPanel({ stats }: { stats: ConsumptionStats }) {
  const { rates } = stats;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Consumption &amp; cost
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Metered usage for OpenAI tokens, Meta WhatsApp sends, and Infobip SMS segments.
          Costs are estimates from env rate cards — align with your invoices.
        </p>
      </div>

      {!stats.meteredAvailable && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Usage tracking is not active yet.
          {stats.meteredError ? ` ${stats.meteredError}` : null}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <PeriodTable title="Last 30 days" period={stats.last30Days} />
        <PeriodTable title="All time (metered)" period={stats.allTime} />
      </div>

      <details className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-950">
        <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-300">
          Rate card (env overrides)
        </summary>
        <ul className="mt-2 space-y-1 text-stone-600 dark:text-stone-400">
          <li>
            OpenAI input: ${rates.openAiInputUsdPer1M.toFixed(2)} / 1M tokens
          </li>
          <li>
            OpenAI output: ${rates.openAiOutputUsdPer1M.toFixed(2)} / 1M tokens
          </li>
          <li>
            Meta template message: {formatUsd(rates.metaTemplateUsd)} each
          </li>
          <li>
            Meta free-text message: {formatUsd(rates.metaTextUsd)} each
          </li>
          <li>
            Infobip SMS segment: {formatUsd(rates.infobipSegmentUsd)} each
          </li>
        </ul>
      </details>
    </section>
  );
}
