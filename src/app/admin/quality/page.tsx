import { QualityConsumptionPanel } from "@/components/admin/quality-consumption-panel";
import { RefreshDataButton } from "@/components/admin/refresh-data-button";
import { getConsumptionStats } from "@/lib/admin/consumption-queries";
import { getQualityStats } from "@/lib/admin/queries";

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "teal" | "amber";
}) {
  const valueClass =
    tone === "teal"
      ? "text-3xl font-semibold text-teal-800 dark:text-teal-300"
      : tone === "amber"
        ? "text-3xl font-semibold text-amber-800 dark:text-amber-300"
        : "text-3xl font-semibold text-stone-900 dark:text-stone-50";
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
      <p className={valueClass}>
        {value}
        {sub && <span className="ml-1.5 text-lg text-stone-400 dark:text-stone-500">{sub}</span>}
      </p>
    </div>
  );
}

function ChannelMixChart({
  total,
  mix,
}: {
  total: number;
  mix: {
    whatsappOnly: number;
    smsOnly: number;
  };
}) {
  if (total === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        No outbound messages yet — this chart will show how contacted clients split across WhatsApp and SMS
        once you have data.
      </p>
    );
  }

  const pct = (n: number) => (total > 0 ? (100 * n) / total : 0);
  const segments = [
    {
      key: "wa",
      label: "WhatsApp",
      count: mix.whatsappOnly,
      widthPct: pct(mix.whatsappOnly),
      barClass: "bg-emerald-600 dark:bg-emerald-500",
      dotClass: "bg-emerald-600",
    },
    {
      key: "sms",
      label: "SMS",
      count: mix.smsOnly,
      widthPct: pct(mix.smsOnly),
      barClass: "bg-sky-600 dark:bg-sky-500",
      dotClass: "bg-sky-600",
    },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-5">
      <div
        className="flex h-8 w-full overflow-hidden rounded-full ring-1 ring-stone-200 dark:ring-stone-600"
        role="img"
        aria-label={`Contacted clients by channel mix: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className={`${s.barClass} min-w-0 shrink-0 transition-[width] duration-500 first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${s.widthPct}%` }}
            title={`${s.label}: ${s.count} (${s.widthPct.toFixed(1)}%)`}
          />
        ))}
      </div>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          {
            key: "wa",
            label: "WhatsApp",
            count: mix.whatsappOnly,
            dotClass: "bg-emerald-600",
          },
          {
            key: "sms",
            label: "SMS",
            count: mix.smsOnly,
            dotClass: "bg-sky-600",
          },
        ].map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <span className={`size-2.5 shrink-0 rounded-full ${row.dotClass}`} aria-hidden />
            <span className="font-medium">{row.label}</span>
            <span className="tabular-nums text-stone-500 dark:text-stone-400">
              {row.count}
              <span className="text-stone-400 dark:text-stone-500">
                {" "}
                ({pct(row.count).toFixed(1)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default async function QualityPage() {
  const [s, consumption] = await Promise.all([
    getQualityStats(),
    getConsumptionStats(),
  ]);
  const denom = Math.max(s.clientsContacted, 1);
  const replyRate = Math.round((s.clientsReplied / denom) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Quality</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Messaging funnel, channel mix, replies, and provider consumption (OpenAI, Meta, SMS).
          </p>
        </div>
        <RefreshDataButton />
      </div>

      <QualityConsumptionPanel stats={consumption} />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Messaging funnel
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Messages sent" value={s.outboundMessages} tone="neutral" />
          <Stat label="Clients contacted" value={s.clientsContacted} tone="teal" />
          <Stat
            label="Clients who replied"
            value={s.clientsReplied}
            sub={`(${replyRate}%)`}
            tone="teal"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Outbound by channel
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Messages via WhatsApp" value={s.messagesViaWhatsapp} tone="teal" />
          <Stat label="Messages via SMS" value={s.messagesViaSms} tone="neutral" />
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:shadow-none">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">
          Contacted clients by channel
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Each client is on one channel only (WhatsApp or SMS), based on the case&apos;s current channel.
        </p>
        <div className="mt-6">
          <ChannelMixChart total={s.clientsContacted} mix={s.channelClientMix} />
        </div>
      </section>    </div>
  );
}
