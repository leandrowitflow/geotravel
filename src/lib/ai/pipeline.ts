import { generateObjectTracked } from "@/lib/usage/generate-object-tracked";
import type { UsageRecordContext } from "@/lib/usage/record-provider-usage";
import { z } from "zod";
import {
  hasOpenAiConfigured,
  openAiChatModel,
} from "@/lib/ai/openai-client";
import {
  LANGUAGE_CONFIDENCE_THRESHOLD,
  SUPPORTED_LANGUAGES,
  extractionFieldsSchema,
  type ExtractionFields,
  type ExtractionResult,
  type SupportedLanguage,
} from "@/lib/contracts/extraction";
import { buildOperationalExtractionPrompt } from "@/lib/ai/extraction-prompt";
import type { CollectedDataJson } from "@/db/schema";
import { mergeCollectedData } from "@/lib/orchestration/collected-data-merge";
import { firstNameFromDisplayName } from "@/lib/passenger/first-name";
import type { WhatsappTemplateConversationContext } from "@/lib/geotravel/whatsapp-template-ai-context";
import type { MessagingChannel } from "@/lib/messaging/types";
import { SMS_LIFECYCLE_MAX_CHARS } from "@/lib/geotravel/build-lifecycle-sms-body";
import {
  assistantLocaleLabel,
  assistantSystemPreamble,
  minimalAssistantFallback,
  toAssistantLocale,
} from "@/lib/ai/assistant-locale";
import {
  fieldIntentForAi,
  type FieldKey,
} from "@/lib/orchestration/field-prompts";

function passengerContextLine(passengerName: string | null | undefined): string {
  const full = (passengerName ?? "").trim();
  if (!full) return "Passenger name: (not on file yet)";
  const first = firstNameFromDisplayName(full);
  return `Passenger name: ${full}${first && first !== full ? ` (first name for greeting: ${first})` : ""}`;
}

function replyChannelLabel(channel?: MessagingChannel): string {
  return channel === "sms" ? "SMS" : "WhatsApp";
}

function lengthHint(channel?: MessagingChannel): string {
  return channel === "sms"
    ? `Keep the reply within ~${SMS_LIFECYCLE_MAX_CHARS} characters (single SMS or two parts max).`
    : "Keep the reply concise for WhatsApp.";
}

function templateContextBlock(
  ctx: WhatsappTemplateConversationContext | null | undefined,
  channel?: MessagingChannel,
): string {
  const via = replyChannelLabel(channel);
  if (!ctx) return `Last outbound ${via}: unknown (no template context on file).`;
  return `Last outbound ${via} template phase: ${ctx.phase}
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
  opts?: { phoneSuggestsPortuguese?: boolean; usage?: UsageRecordContext },
): Promise<LanguageDetection> {
  if (!hasOpenAiConfigured()) {
    return { language: opts?.phoneSuggestsPortuguese ? "pt" : "en", confidence: 0.3 };
  }
  const phoneHint = opts?.phoneSuggestsPortuguese
    ? "The customer's phone number is Portuguese (+351). Short replies like Ok/Sim/4 often mean Portuguese."
    : "";
  const { object } = await generateObjectTracked(
    opts?.usage ?? { operation: "language_detect" },
    {
    model: openAiChatModel(),
    schema: languageSchema,
    prompt: `Detect whether this customer message is primarily in English or Portuguese.
Return "pt" for Portuguese (Portugal or Brazil — treat both as pt).
Return "en" for English or any other language (Spanish, French, German, etc.).
${phoneHint}
Text:\n"""${text.slice(0, 2000)}"""`,
    },
  );
  return object;
}

export { minimalAssistantFallback };

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

function stripNullExtractionFields(fields: ExtractionFields): ExtractionResult {
  const out: ExtractionResult = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

function assignExtractionConfidence(fields: ExtractionFields): ExtractionResult {
  const stripped = stripNullExtractionFields(fields);
  const confidence: Record<string, number> = {};
  for (const key of Object.keys(stripped)) {
    confidence[key] = 0.9;
  }
  return { ...stripped, confidence };
}

export async function extractOperationalFields(input: {
  customerMessage: string;
  prior: Partial<ExtractionResult> | null;
  usage?: UsageRecordContext;
}): Promise<ExtractionResult> {
  if (!hasOpenAiConfigured()) {
    return { confidence: {} };
  }
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "extract_fields" },
    {
      model: openAiChatModel(),
      schema: extractionFieldsSchema,
      prompt: buildOperationalExtractionPrompt(
        input.customerMessage,
        input.prior,
      ),
    },
  );
  return assignExtractionConfidence(object);
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
  channel?: MessagingChannel;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "needs_human_ack" },
    {
      model: openAiChatModel(),
      schema: assistantAckSchema,
      prompt: `${assistantSystemPreamble(locale)}

This booking is with a human agent for review, but the customer just sent a message on ${replyChannelLabel(input.channel)}.

Write ONE short reply in ${assistantLocaleLabel(locale)}:
${lengthHint(input.channel)}
- Thank them and acknowledge what they said at a high level.
- If a passenger name is on file, you may use the first name once in a polite greeting; if unknown, do not invent a name.
- If you can safely answer from the context (pickup time/location, booking ref), do so briefly — unless template rules say not to discuss the trip.
- Otherwise say our team will respond shortly. Do not promise refunds, cancellations, or price changes.
- Do not ask for payment or personal documents.

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Pickup / trip context: ${input.pickupSummary ?? "unknown"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""`,
    },
  );
  return object.reply.trim() || null;
}

export function cannedNeedsHumanAck(lang: SupportedLanguage): string {
  return minimalAssistantFallback(lang);
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
  channel?: MessagingChannel;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "naturalize_reply" },
    {
      model: openAiChatModel(),
      schema: naturalizeSchema,
      prompt: `${assistantSystemPreamble(locale)}

Rewrite the "scripted intent" as a single professional ${replyChannelLabel(input.channel)} message in ${assistantLocaleLabel(locale)}.
Rules:
- Keep the same purpose (questions asked, facts stated, yes/no prompts) unless template rules forbid that topic.
- Do not invent pickup times, prices, policies, or new commitments.
- ${lengthHint(input.channel)}
- If passenger name is on file, you may use the first name once politely; if not on file, do not invent.

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Reservation context: ${input.reservationSummary}

Recent thread:
${input.transcript || "(no prior messages)"}

Customer just said:
"""${input.userMessage.slice(0, 2000)}"""

Scripted intent to preserve:
"""${input.scriptedIntent.slice(0, 2000)}"""`,
    },
  );
  return object.message.trim() || null;
}

const FIELD_ORDER = [
  "passenger_count_actual",
  "children_count",
  "cabin_luggage",
  "checked_luggage",
  "extras",
  "reduced_mobility_present",
  "additional_notes",
] as const;

/** Natural reply asking for the next operational detail we still need. */
export async function generateWhatsappEnrichmentAsk(input: {
  fieldKey: string;
  userMessage: string;
  transcript: string;
  language: SupportedLanguage;
  reservationSummary: string;
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
  channel?: MessagingChannel;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const fieldIntent =
    (FIELD_ORDER as readonly string[]).includes(input.fieldKey)
      ? fieldIntentForAi(input.fieldKey as FieldKey)
      : fieldIntentForAi("additional_notes");
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "enrichment_ask" },
    {
      model: openAiChatModel(),
      schema: enrichmentAskSchema,
      prompt: `${assistantSystemPreamble(locale)}

You are continuing a private transfer booking conversation on ${replyChannelLabel(input.channel)}.

Write ONE natural message in ${assistantLocaleLabel(locale)}:
${lengthHint(input.channel)}
- First respond to what the customer just said (acknowledge, answer, or clarify) in a human way.
- Then, if still needed, ask for: ${fieldIntent}.
- Do not repeat the full booking itinerary unless they asked.
- Do not invent pickup times, prices, or policies.

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Reservation: ${input.reservationSummary}

Thread:
${input.transcript || "(no prior messages)"}

Customer just said:
"""${input.userMessage.slice(0, 2000)}"""`,
    },
  );
  return object.message.trim() || null;
}

export type OrchestrationTurnKind =
  | "consent_future_comms"
  | "enrichment_complete_ack"
  | "summarize_correction"
  | "commercial_return"
  | "crm_sync_failed"
  | "present_summary";

/** Natural reply for workflow steps (not lifecycle templates). */
export async function generateOrchestrationTurnReply(input: {
  kind: OrchestrationTurnKind;
  userMessage: string;
  transcript: string;
  language: SupportedLanguage;
  reservationSummary: string;
  bookingRef: string | null;
  passengerName?: string | null;
  whatsappTemplateContext?: WhatsappTemplateConversationContext | null;
  channel?: MessagingChannel;
  summaryText?: string;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const intentByKind: Record<OrchestrationTurnKind, string> = {
    consent_future_comms:
      "After they confirmed trip details, ask politely if Geotravel may send helpful reminders about future transfers by WhatsApp or SMS. They should answer yes or no (sim/não, yes/no). One short question — no pressure if they decline.",
    enrichment_complete_ack:
      "Thank them warmly for the passenger/luggage/extras information. Say we have what we need for the driver and that we will confirm again the day before pickup. Do not ask more operational questions.",
    summarize_correction:
      "They replied that the summary is not correct. Apologise briefly for the mismatch and ask what to change (which field: passengers, bags, extras, notes). Invite them to write the correction in one message.",
    commercial_return:
      "They may be eligible for a return transfer. Offer once, naturally, to arrange the return leg — interested or not. No hard sell; one sentence plus space to answer.",
    crm_sync_failed:
      "We received their confirmation but had a technical issue saving to our systems. Reassure them we have their message and our team will complete the booking record manually and contact them only if needed.",
    present_summary:
      "Present the collected trip details from the summary below in natural prose (not a bullet questionnaire). Ask them to confirm everything is correct or tell us what to fix. Accept yes/no/sim/não style answers.",
  };
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: `orchestration_${input.kind}` },
    {
      model: openAiChatModel(),
      schema: catchAllSchema,
      prompt: `${assistantSystemPreamble(locale)}

Workflow step (internal): ${input.kind}
Goal: ${intentByKind[input.kind]}

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Trip: ${input.reservationSummary}
${input.summaryText ? `\nSummary to present:\n${input.summaryText}` : ""}

Thread:
${input.transcript || "(empty)"}

Customer just said:
"""${input.userMessage.slice(0, 2000)}"""

Write ONE natural reply in ${assistantLocaleLabel(locale)}:
${lengthHint(input.channel)}`,
    },
  );
  return object.reply.trim() || null;
}

/** @deprecated Use minimalAssistantFallback — kept for imports during migration */
export function cannedWhatsappCatchAllReply(lang: SupportedLanguage): string {
  return minimalAssistantFallback(lang);
}

export function cannedCrmHandoffAfterSyncFail(lang: SupportedLanguage): string {
  return minimalAssistantFallback(lang);
}

export function cannedWhatsappTemplateAwareReply(
  lang: SupportedLanguage,
  _phase: WhatsappTemplateConversationContext["phase"],
): string {
  return minimalAssistantFallback(lang);
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
  channel?: MessagingChannel;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "template_aware_reply" },
    {
      model: openAiChatModel(),
      schema: catchAllSchema,
      prompt: `${assistantSystemPreamble(locale)}

The customer is replying on ${replyChannelLabel(input.channel)} after we sent them a specific template message.

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Booking ref (use only if appropriate for this template): ${input.bookingRef ?? "unknown"}
Trip context (do not repeat unless the customer asks): ${input.reservationSummary}

Thread:
${input.transcript || "(empty)"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""

Write ONE reply in ${assistantLocaleLabel(locale)}:
${lengthHint(input.channel)}
- Directly address what they said with empathy and professionalism.
- Strictly follow template-aware rules — they override generic transfer-assistant habits.
- Do not invent refunds, amounts, or policies.`,
    },
  );
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
  channel?: MessagingChannel;
  usage?: UsageRecordContext;
}): Promise<string | null> {
  if (!hasOpenAiConfigured()) {
    return null;
  }
  const locale = toAssistantLocale(input.language);
  const { object } = await generateObjectTracked(
    input.usage ?? { operation: "catch_all_reply" },
    {
      model: openAiChatModel(),
      schema: catchAllSchema,
      prompt: `${assistantSystemPreamble(locale)}

You are helping a passenger with their airport transfer on ${replyChannelLabel(input.channel)}.
Internal workflow state (do not mention literally): ${input.orchestrationState}

${templateContextBlock(input.whatsappTemplateContext, input.channel)}

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Trip summary: ${input.reservationSummary}

Thread:
${input.transcript || "(empty)"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""

Write ONE helpful reply in ${assistantLocaleLabel(locale)}:
${lengthHint(input.channel)}
- Answer what you safely can from context (pickup/destination/ref) unless template rules say otherwise.
- If passenger name is on file, you may greet with first name once politely; otherwise do not invent a name.
- If you cannot answer (policy, changes, billing), say our team will confirm shortly — do not invent facts.`,
    },
  );
  return object.reply.trim() || null;
}

export function mergeExtraction(
  prior: Record<string, unknown> | null | undefined,
  next: ExtractionResult,
): Record<string, unknown> {
  return mergeCollectedData(prior as CollectedDataJson | null, next);
}
