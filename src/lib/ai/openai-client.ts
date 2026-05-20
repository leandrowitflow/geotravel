import { createOpenAI } from "@ai-sdk/openai";

/** Default chat model for extraction, language detection, and WhatsApp replies. */
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export function resolveOpenAiModelId(): string {
  const fromEnv = process.env.OPENAI_MODEL?.trim();
  return fromEnv || DEFAULT_OPENAI_MODEL;
}

export function hasOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

let cachedProvider: ReturnType<typeof createOpenAI> | null = null;

export function getOpenAiProvider(): ReturnType<typeof createOpenAI> {
  if (!hasOpenAiConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!cachedProvider) {
    cachedProvider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return cachedProvider;
}

/** Vercel AI SDK language model used by `generateObject` across the app. */
export function openAiChatModel() {
  return getOpenAiProvider()(resolveOpenAiModelId());
}
