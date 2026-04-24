import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  LANGUAGE_CONFIDENCE_THRESHOLD,
  SUPPORTED_LANGUAGES,
  extractionResultSchema,
  type ExtractionResult,
  type SupportedLanguage,
} from "@/lib/contracts/extraction";

const languageSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  confidence: z.number().min(0).max(1),
});

export type LanguageDetection = z.infer<typeof languageSchema>;

export async function detectLanguageFromText(
  text: string,
): Promise<LanguageDetection> {
  if (!process.env.OPENAI_API_KEY) {
    return { language: "en", confidence: 0.3 };
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: languageSchema,
    prompt: `Detect the primary language of this customer message. Return one of: en, pt, es, fr, de. Text:\n"""${text.slice(0, 2000)}"""`,
  });
  return object;
}

export function resolveConversationLanguage(
  detection: LanguageDetection,
  fallback: SupportedLanguage,
): SupportedLanguage {
  if (detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD) {
    return detection.language;
  }
  return fallback;
}

export async function extractOperationalFields(input: {
  customerMessage: string;
  prior: Partial<ExtractionResult> | null;
}): Promise<ExtractionResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { confidence: {} };
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: extractionResultSchema,
    prompt: `Extract operational transfer booking details from the message. Use null if unknown. Prior known values (may update): ${JSON.stringify(input.prior ?? {})}\n\nMessage:\n"""${input.customerMessage.slice(0, 4000)}"""`,
  });
  return object;
}

export function mergeExtraction(
  prior: Record<string, unknown> | null | undefined,
  next: ExtractionResult,
): Record<string, unknown> {
  const base = { ...(prior ?? {}) };
  for (const [k, v] of Object.entries(next)) {
    if (k === "confidence") continue;
    if (v !== undefined && v !== null) {
      (base as Record<string, unknown>)[k] = v;
    }
  }
  if (next.confidence) {
    base.collection_confidence = {
      ...((base.collection_confidence as Record<string, number>) ?? {}),
      ...next.confidence,
    };
  }
  return base;
}
