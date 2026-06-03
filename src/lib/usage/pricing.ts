/** Estimated unit costs (USD) — override via env to match your Infobip/Meta/OpenAI invoices. */

function parseUsdPerMillion(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseUsd(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function openAiInputUsdPer1M(): number {
  return parseUsdPerMillion("OPENAI_USD_PER_1M_INPUT_TOKENS", 2.5);
}

export function openAiOutputUsdPer1M(): number {
  return parseUsdPerMillion("OPENAI_USD_PER_1M_OUTPUT_TOKENS", 10);
}

export function metaWhatsappTemplateUsd(): number {
  return parseUsd("META_WHATSAPP_USD_PER_TEMPLATE", 0.065);
}

export function metaWhatsappTextUsd(): number {
  return parseUsd("META_WHATSAPP_USD_PER_TEXT_MESSAGE", 0.04);
}

export function infobipSmsUsdPerSegment(): number {
  return parseUsd("INFOBIP_SMS_USD_PER_SEGMENT", 0.085);
}

export function estimateOpenAiCostUsd(input: {
  inputTokens: number;
  outputTokens: number;
}): number {
  const inCost = (input.inputTokens / 1_000_000) * openAiInputUsdPer1M();
  const outCost = (input.outputTokens / 1_000_000) * openAiOutputUsdPer1M();
  return inCost + outCost;
}

export function estimateMetaWhatsappCostUsd(input: {
  isTemplate: boolean;
}): number {
  return input.isTemplate ? metaWhatsappTemplateUsd() : metaWhatsappTextUsd();
}

export function estimateInfobipSmsCostUsd(segments: number): number {
  return segments * infobipSmsUsdPerSegment();
}

export type ConsumptionRateCard = {
  openAiInputUsdPer1M: number;
  openAiOutputUsdPer1M: number;
  metaTemplateUsd: number;
  metaTextUsd: number;
  infobipSegmentUsd: number;
};

export function getConsumptionRateCard(): ConsumptionRateCard {
  return {
    openAiInputUsdPer1M: openAiInputUsdPer1M(),
    openAiOutputUsdPer1M: openAiOutputUsdPer1M(),
    metaTemplateUsd: metaWhatsappTemplateUsd(),
    metaTextUsd: metaWhatsappTextUsd(),
    infobipSegmentUsd: infobipSmsUsdPerSegment(),
  };
}
