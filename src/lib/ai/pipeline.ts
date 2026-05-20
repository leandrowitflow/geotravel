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
import { buildOperationalExtractionPrompt } from "@/lib/ai/extraction-prompt";
import type { CollectedDataJson } from "@/db/schema";
import { mergeCollectedData } from "@/lib/orchestration/collected-data-merge";
import { firstNameFromDisplayName } from "@/lib/passenger/first-name";
import type { WhatsappTemplateConversationContext } from "@/lib/geotravel/whatsapp-template-ai-context";
import {
  assistantLocaleLabel,
  assistantSystemPreamble,
  cannedCrmHandoffAfterSyncFail as cannedCrmHandoffLocale,
  cannedNeedsHumanAck as cannedNeedsHumanLocale,
  cannedWhatsappCatchAllReply as cannedCatchAllLocale,
  cannedWhatsappTemplateAwareReply as cannedTemplateAwareLocale,
  toAssistantLocale,
} from "@/lib/ai/assistant-locale";

function passengerContextLine(passengerName: string | null | undefined): string {
  const full = (passengerName ?? "").trim();
  if (!full) return "Passenger name: (not on file yet)";
  const first = firstNameFromDisplayName(full);
  return `Passenger name: ${full}${first && first !== full ? ` (first name for greeting: ${first})` : ""}`;
}

function templateContextBlock(
  ctx: WhatsappTemplateConversationContext | null | undefined,
): string {
  if (!ctx) return "Last outbound: unknown (no template context on file).";
  return `Last WhatsApp template phase: ${ctx.phase}
Template-aware reply rules (must follow):
${ctx.aiInstructions}`;
}

const assistantAckSchema = z.object({
  reply: z.string().min(1).max(600),
});

const naturalizeSchema = z.object({
  message: z.string().min(1).max(900),
});

const enrichmentAskSchema = z.object({
  message: z.string().min(1).max(900),
});

const catchAllSchema = z.object({
  reply: z.string().min(1).max(900),
});

const assistantLanguageSchema = z.object({
  language: z.enum(["en", "pt"]),
  confidence: z.number().min(0).max(1),
});

const languageSchema = assistantLanguageSchema;

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
    prompt: `Detect whether this customer message is primarily in English or Portuguese.
Return "pt" for Portuguese (Portugal or Brazil — treat both as pt).
Return "en" for English or any other language (Spanish, French, German, etc.).
Text:\n"""${text.slice(0, 2000)}"""`,
  });
  return object;
}

export function resolveConversationLanguage(
  detection: LanguageDetection,
  fallback: SupportedLanguage,
): SupportedLanguage {
  const raw =
    detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
      ? detection.language
      : fallback;
  return toAssistantLocale(raw);
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
    prompt: buildOperationalExtractionPrompt(
      input.customerMessage,
      input.prior,
    ),
  });
  return object;
}

/** Short reply when a human is handling the case; uses OpenAI when configured. */
export async function generateInboundAssistantReply(input: {
  userMessage: string;
  language: SupportedLanguage;
  bookingRef: string | null;
  pickupSummary: string | null;
  /** Full name from reservation / API when available */
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: assistantAckSchema,
    prompt: `${assistantSystemPreamble(locale)}

This booking is with a human agent for review, but the customer just sent a message.

Write ONE short reply (max ~400 characters) in ${assistantLocaleLabel(locale)}:
- Thank them and acknowledge what they said at a high level.
- If a passenger name is on file, you may use the first name once in a polite greeting; if unknown, do not invent a name.
- If you can safely answer from the context (pickup time/location, booking ref), do so briefly — unless template rules say not to discuss the trip.
- Otherwise say our team will respond shortly. Do not promise refunds, cancellations, or price changes.
- Do not ask for payment or personal documents.

${templateContextBlock(input.whatsappTemplateContext)}

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Pickup / trip context: ${input.pickupSummary ?? "unknown"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""`,
  });
  return object.reply.trim() || null;
}

export function cannedNeedsHumanAck(lang: SupportedLanguage): string {
  return cannedNeedsHumanLocale(lang);
}

/** Rephrase scripted orchestration copy into natural WhatsApp tone (same facts / asks). */
export async function naturalizeWhatsappReply(input: {
  scriptedIntent: string;
  userMessage: string;
  transcript: string;
  language: SupportedLanguage;
  reservationSummary: string;
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: naturalizeSchema,
    prompt: `${assistantSystemPreamble(locale)}

Rewrite the "scripted intent" as a single professional WhatsApp message in ${assistantLocaleLabel(locale)}.
Rules:
- Keep the same purpose (questions asked, facts stated, yes/no prompts) unless template rules forbid that topic.
- Do not invent pickup times, prices, policies, or new commitments.
- Short paragraphs, max ~600 characters if possible.
- If passenger name is on file, you may use the first name once politely; if not on file, do not invent.

${templateContextBlock(input.whatsappTemplateContext)}

${passengerContextLine(input.passengerName)}
Reservation context: ${input.reservationSummary}

Recent thread:
${input.transcript || "(no prior messages)"}

Customer just said:
"""${input.userMessage.slice(0, 2000)}"""

Scripted intent to preserve:
"""${input.scriptedIntent.slice(0, 2000)}"""`,
  });
  return object.message.trim() || null;
}

/** One natural WhatsApp bubble asking for the next enrichment field (replaces dry scripted prompt). */
export async function generateWhatsappEnrichmentAsk(input: {
  fieldKey: string;
  scriptedQuestion: string;
  userMessage: string;
  transcript: string;
  language: SupportedLanguage;
  reservationSummary: string;
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: enrichmentAskSchema,
    prompt: `${assistantSystemPreamble(locale)}

You are helping finalise a private transfer booking.

Write ONE short message in ${assistantLocaleLabel(locale)} (max ~650 characters):
- No bullet lists unless truly needed.
- Ask for EXACTLY the same information as the scripted question — same topic, same intent.
- Do not invent pickup times, prices, or policies. Do not promise refunds or cancellations.
- If passenger name is on file, you may use the first name once; if not on file, do not invent.
- Follow template-aware rules below — they override generic "confirm your trip" tone when they conflict.

${templateContextBlock(input.whatsappTemplateContext)}

${passengerContextLine(input.passengerName)}
Field key (internal): ${input.fieldKey}
Scripted question to cover (must not skip any part of this ask):
"""${input.scriptedQuestion}"""

Reservation: ${input.reservationSummary}

Thread:
${input.transcript || "(no prior messages)"}

Customer just said:
"""${input.userMessage.slice(0, 2000)}"""`,
  });
  return object.message.trim() || null;
}

export function cannedWhatsappTemplateAwareReply(
  lang: SupportedLanguage,
  phase: WhatsappTemplateConversationContext["phase"],
): string {
  if (phase === "canceled" || phase === "satisfaction") {
    return cannedTemplateAwareLocale(lang, phase);
  }
  return cannedWhatsappCatchAllReply(lang);
}

export function cannedWhatsappCatchAllReply(lang: SupportedLanguage): string {
  return cannedCatchAllLocale(lang);
}

export function cannedCrmHandoffAfterSyncFail(lang: SupportedLanguage): string {
  return cannedCrmHandoffLocale(lang);
}

/** When no scripted outbound ran (e.g. awaiting_d1 chit-chat), generate one helpful WhatsApp reply. */
/** Reply when the last outbound was cancel / satisfaction (no operational enrichment). */
export async function generateWhatsappTemplateAwareReply(input: {
  userMessage: string;
  language: SupportedLanguage;
  transcript: string;
  reservationSummary: string;
  bookingRef: string | null;
  passengerName?: string | null;
  whatsappTemplateContext: WhatsappTemplateConversationContext;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: catchAllSchema,
    prompt: `${assistantSystemPreamble(locale)}

The customer is replying after we sent them a specific Meta template message.

${templateContextBlock(input.whatsappTemplateContext)}

${passengerContextLine(input.passengerName)}
Booking ref (use only if appropriate for this template): ${input.bookingRef ?? "unknown"}
Trip context (do not repeat unless the customer asks): ${input.reservationSummary}

Thread:
${input.transcript || "(empty)"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""

Write ONE reply in ${assistantLocaleLabel(locale)} (max ~650 characters):
- Directly address what they said with empathy and professionalism.
- Strictly follow template-aware rules — they override generic transfer-assistant habits.
- Do not invent refunds, amounts, or policies.`,
  });
  return object.reply.trim() || null;
}

export async function generateWhatsappCatchAllReply(input: {
  userMessage: string;
  language: SupportedLanguage;
  orchestrationState: string;
  transcript: string;
  reservationSummary: string;
  bookingRef: string | null;
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: catchAllSchema,
    prompt: `${assistantSystemPreamble(locale)}

You are helping a passenger with their airport transfer.
Internal workflow state (do not mention literally): ${input.orchestrationState}

${templateContextBlock(input.whatsappTemplateContext)}

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Trip summary: ${input.reservationSummary}

Thread:
${input.transcript || "(empty)"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""

Write ONE helpful reply in ${assistantLocaleLabel(locale)} (max ~700 characters):
- Answer what you safely can from context (pickup/destination/ref) unless template rules say otherwise.
- If passenger name is on file, you may greet with first name once politely; otherwise do not invent a name.
- If you cannot answer (policy, changes, billing), say our team will confirm shortly — do not invent facts.`,
  });
  return object.reply.trim() || null;
}

export function mergeExtraction(
  prior: Record<string, unknown> | null | undefined,
  next: ExtractionResult,
): Record<string, unknown> {
  return mergeCollectedData(prior as CollectedDataJson | null, next);
}
