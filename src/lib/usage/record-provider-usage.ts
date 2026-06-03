import { serviceSupabase } from "@/lib/supabase/service-role";
import {
  estimateInfobipSmsCostUsd,
  estimateMetaWhatsappCostUsd,
  estimateOpenAiCostUsd,
} from "@/lib/usage/pricing";
import {
  estimateSmsSegments,
  smsUsesUcs2Encoding,
} from "@/lib/usage/estimate-sms-segments";

export type UsageProvider = "openai" | "meta" | "infobip";

export type UsageRecordContext = {
  operation: string;
  caseId?: string | null;
  reservationId?: string | null;
  channel?: string | null;
};

type OpenAiUsageShape = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

function pickTokenCounts(usage: OpenAiUsageShape | undefined): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const inputTokens = Math.max(0, Number(usage?.inputTokens ?? 0));
  const outputTokens = Math.max(0, Number(usage?.outputTokens ?? 0));
  const totalTokens = Math.max(
    0,
    Number(usage?.totalTokens ?? inputTokens + outputTokens),
  );
  return { inputTokens, outputTokens, totalTokens };
}

async function insertUsageEvent(row: {
  provider: UsageProvider;
  operation: string;
  caseId?: string | null;
  reservationId?: string | null;
  channel?: string | null;
  quantity: number;
  unit: string;
  estimatedCostUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = serviceSupabase();
    const { error } = await sb.from("provider_usage_events").insert({
      provider: row.provider,
      operation: row.operation,
      case_id: row.caseId ?? null,
      reservation_id: row.reservationId ?? null,
      channel: row.channel ?? null,
      quantity: row.quantity,
      unit: row.unit,
      estimated_cost_usd: row.estimatedCostUsd,
      metadata: row.metadata ?? null,
    });
    if (error) {
      console.warn("[usage] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[usage] insert exception:", e);
  }
}

export async function recordOpenAiUsage(input: {
  context: UsageRecordContext;
  usage?: OpenAiUsageShape;
  model: string;
}): Promise<void> {
  const { inputTokens, outputTokens, totalTokens } = pickTokenCounts(
    input.usage,
  );
  if (totalTokens <= 0 && inputTokens <= 0 && outputTokens <= 0) {
    return;
  }
  await insertUsageEvent({
    provider: "openai",
    operation: input.context.operation,
    caseId: input.context.caseId,
    reservationId: input.context.reservationId,
    channel: input.context.channel,
    quantity: totalTokens,
    unit: "tokens",
    estimatedCostUsd: estimateOpenAiCostUsd({ inputTokens, outputTokens }),
    metadata: {
      model: input.model,
      inputTokens,
      outputTokens,
    },
  });
}

export async function recordMetaWhatsappUsage(input: {
  context: UsageRecordContext;
  templateName?: string | null;
}): Promise<void> {
  const isTemplate = Boolean(input.templateName?.trim());
  await insertUsageEvent({
    provider: "meta",
    operation: input.context.operation,
    caseId: input.context.caseId,
    reservationId: input.context.reservationId,
    channel: "whatsapp",
    quantity: 1,
    unit: "message",
    estimatedCostUsd: estimateMetaWhatsappCostUsd({ isTemplate }),
    metadata: {
      templateName: input.templateName ?? null,
      messageKind: isTemplate ? "template" : "text",
    },
  });
}

export async function recordInfobipSmsUsage(input: {
  context: UsageRecordContext;
  body: string;
  apiMessageCount?: number;
}): Promise<void> {
  const segments = estimateSmsSegments(input.body, input.apiMessageCount);
  if (segments <= 0) return;
  await insertUsageEvent({
    provider: "infobip",
    operation: input.context.operation,
    caseId: input.context.caseId,
    reservationId: input.context.reservationId,
    channel: "sms",
    quantity: segments,
    unit: "sms_segment",
    estimatedCostUsd: estimateInfobipSmsCostUsd(segments),
    metadata: {
      charCount: input.body.length,
      ucs2: smsUsesUcs2Encoding(input.body),
      apiMessageCount: input.apiMessageCount ?? null,
    },
  });
}
