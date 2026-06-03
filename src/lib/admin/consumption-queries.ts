import { getConsumptionRateCard } from "@/lib/usage/pricing";
import { serviceSupabase } from "@/lib/supabase/service-role";

export type ProviderConsumptionBucket = {
  provider: "openai" | "meta" | "infobip";
  label: string;
  eventCount: number;
  quantityLabel: string;
  quantity: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type ConsumptionPeriodStats = {
  totalUsd: number;
  providers: ProviderConsumptionBucket[];
};

export type ConsumptionStats = {
  meteredAvailable: boolean;
  meteredError: string | null;
  allTime: ConsumptionPeriodStats;
  last30Days: ConsumptionPeriodStats;
  rates: ReturnType<typeof getConsumptionRateCard>;
};

type UsageRow = {
  provider: string;
  operation: string;
  quantity: number | string;
  unit: string;
  estimated_cost_usd: number | string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyBucket(
  provider: ProviderConsumptionBucket["provider"],
  label: string,
  quantityLabel: string,
): ProviderConsumptionBucket {
  return {
    provider,
    label,
    eventCount: 0,
    quantityLabel,
    quantity: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  };
}

function aggregateUsageRows(rows: UsageRow[]): ConsumptionPeriodStats {
  const openai = emptyBucket("openai", "OpenAI", "tokens");
  const meta = emptyBucket("meta", "Meta (WhatsApp)", "messages");
  const infobip = emptyBucket("infobip", "Infobip (SMS)", "segments");

  for (const row of rows) {
    const cost = num(row.estimated_cost_usd);
    const qty = num(row.quantity);
    const metaJson = row.metadata ?? {};

    if (row.provider === "openai") {
      openai.eventCount++;
      openai.quantity += qty;
      openai.inputTokens += num(metaJson.inputTokens as number | string);
      openai.outputTokens += num(metaJson.outputTokens as number | string);
      openai.estimatedCostUsd += cost;
    } else if (row.provider === "meta") {
      meta.eventCount++;
      meta.quantity += qty;
      meta.estimatedCostUsd += cost;
    } else if (row.provider === "infobip") {
      infobip.eventCount++;
      infobip.quantity += qty;
      infobip.estimatedCostUsd += cost;
    }
  }

  const providers = [openai, meta, infobip];
  return {
    totalUsd: providers.reduce((s, p) => s + p.estimatedCostUsd, 0),
    providers,
  };
}

export async function getConsumptionStats(): Promise<ConsumptionStats> {
  const rates = getConsumptionRateCard();
  const sb = serviceSupabase();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("provider_usage_events")
    .select("provider,operation,quantity,unit,estimated_cost_usd,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(50_000);

  if (error) {
    const missing = /relation.*does not exist|provider_usage_events/i.test(
      error.message,
    );
    const empty: ConsumptionPeriodStats = {
      totalUsd: 0,
      providers: [
        emptyBucket("openai", "OpenAI", "tokens"),
        emptyBucket("meta", "Meta (WhatsApp)", "messages"),
        emptyBucket("infobip", "Infobip (SMS)", "segments"),
      ],
    };
    return {
      meteredAvailable: false,
      meteredError: missing
        ? "Run migration drizzle/0001_provider_usage.sql on Supabase."
        : error.message,
      allTime: empty,
      last30Days: empty,
      rates,
    };
  }

  const rows = (data ?? []) as UsageRow[];
  const last30 = rows.filter((r) => r.created_at >= since30);

  return {
    meteredAvailable: true,
    meteredError: null,
    allTime: aggregateUsageRows(rows),
    last30Days: aggregateUsageRows(last30),
    rates,
  };
}

export function formatUsd(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(4)}`;
}
