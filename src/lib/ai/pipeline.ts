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
import { firstNameFromDisplayName } from "@/lib/passenger/first-name";

function passengerContextLine(passengerName: string | null | undefined): string {
  const full = (passengerName ?? "").trim();
  if (!full) return "Passenger name: (not on file yet)";
  const first = firstNameFromDisplayName(full);
  return `Passenger name: ${full}${first && first !== full ? ` (first name for greeting: ${first})` : ""}`;
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

/** Short reply when a human is handling the case; uses OpenAI when configured. */
export async function generateInboundAssistantReply(input: {
  userMessage: string;
  language: SupportedLanguage;
  bookingRef: string | null;
  pickupSummary: string | null;
  /** Full name from reservation / API when available */
  passengerName?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langHint =
    input.language === "pt"
      ? "Portuguese"
      : input.language === "es"
        ? "Spanish"
        : input.language === "fr"
          ? "French"
          : input.language === "de"
            ? "German"
            : "English";
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: assistantAckSchema,
    prompt: `You are Geotravel's professional WhatsApp assistant. This booking is with a human agent for review, but the customer just sent a message.

Write ONE short reply (max ~400 characters) in ${langHint}:
- Warm, natural tone — not robotic.
- Thank them and acknowledge what they said at a high level.
- If a passenger name is on file, you may use the first name once in a natural greeting; if unknown, do not invent a name.
- If you can safely answer from the context (pickup time/location, booking ref), do so briefly.
- Otherwise say the team will respond soon. Do not promise refunds, cancellations, or price changes.
- Do not ask for payment or personal documents.

${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Pickup / trip context: ${input.pickupSummary ?? "unknown"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""`,
  });
  return object.reply.trim() || null;
}

export function cannedNeedsHumanAck(lang: SupportedLanguage): string {
  switch (lang) {
    case "pt":
      return "Obrigado pela mensagem. A nossa equipa irá responder em breve.";
    case "es":
      return "Gracias por su mensaje. Nuestro equipo le responderá en breve.";
    case "fr":
      return "Merci pour votre message. Notre équipe vous répondra sous peu.";
    case "de":
      return "Vielen Dank für Ihre Nachricht. Unser Team meldet sich in Kürze.";
    case "en":
      return "Thanks for your message. Our team will get back to you shortly.";
  }
}

/** Rephrase scripted orchestration copy into natural WhatsApp tone (same facts / asks). */
export async function naturalizeWhatsappReply(input: {
  scriptedIntent: string;
  userMessage: string;
  transcript: string;
  language: SupportedLanguage;
  reservationSummary: string;
  passengerName?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langHint =
    input.language === "pt"
      ? "Portuguese"
      : input.language === "es"
        ? "Spanish"
        : input.language === "fr"
          ? "French"
          : input.language === "de"
            ? "German"
            : "English";
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: naturalizeSchema,
    prompt: `You are Geotravel's WhatsApp assistant. Rewrite the "scripted intent" as a single warm, natural message in ${langHint}.
Rules:
- Keep the same purpose (questions asked, facts stated, yes/no prompts).
- Do not invent pickup times, prices, policies, or new commitments.
- Short paragraphs, max ~600 characters if possible.
- Sound human: contractions ok, "we/our team" tone, not robotic.
- If passenger name is on file, you may use the first name once naturally; if not on file, do not invent.

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
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langHint =
    input.language === "pt"
      ? "Portuguese"
      : input.language === "es"
        ? "Spanish"
        : input.language === "fr"
          ? "French"
          : input.language === "de"
            ? "German"
            : "English";
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: enrichmentAskSchema,
    prompt: `You are Geotravel's friendly WhatsApp assistant helping finalize a private transfer booking.

Write ONE short message in ${langHint} (max ~650 characters):
- Sound warm and human (contractions ok); no bullet lists unless truly needed.
- Ask for EXACTLY the same information as the scripted question — same topic, same intent.
- Do not invent pickup times, prices, or policies. Do not promise refunds or cancellations.
- If passenger name is on file, you may use the first name once; if not on file, do not invent.

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

export function cannedWhatsappCatchAllReply(lang: SupportedLanguage): string {
  switch (lang) {
    case "pt":
      return "Obrigado pela mensagem. Se precisar de algo sobre o seu transfer, diga-nos e ajudamos já a seguir.";
    case "es":
      return "Gracias por su mensaje. Si necesita algo sobre su transfer, díganos y le ayudamos en seguida.";
    case "fr":
      return "Merci pour votre message. Si vous avez besoin d'aide pour votre transfert, dites-le nous et nous vous repondrons.";
    case "de":
      return "Danke für Ihre Nachricht. Wenn Sie etwas zu Ihrem Transfer brauchen, schreiben Sie uns kurz — wir melden uns.";
    case "en":
      return "Thanks for your message. If you need anything about your transfer, tell us here and we will help right away.";
  }
}

export function cannedCrmHandoffAfterSyncFail(lang: SupportedLanguage): string {
  switch (lang) {
    case "pt":
      return "Recebemos os seus dados, mas houve um problema técnico ao guardar no nosso sistema. A nossa equipa irá concluir isto manualmente e contactá-lo se for necessário.";
    case "es":
      return "Hemos recibido sus datos, pero hubo un problema técnico al guardarlos. Nuestro equipo lo revisará manualmente y le contactará si hace falta.";
    case "fr":
      return "Nous avons bien reçu vos informations, mais une erreur technique est survenue. Notre équipe finalisera cela manuellement et vous recontactera si besoin.";
    case "de":
      return "Wir haben Ihre Angaben erhalten, beim Speichern ist jedoch ein technisches Problem aufgetreten. Unser Team erledigt das manuell und meldet sich bei Bedarf.";
    case "en":
      return "We received your details, but a technical issue occurred while saving them. Our team will finish this manually and follow up if needed.";
  }
}

/** When no scripted outbound ran (e.g. awaiting_d1 chit-chat), generate one helpful WhatsApp reply. */
export async function generateWhatsappCatchAllReply(input: {
  userMessage: string;
  language: SupportedLanguage;
  orchestrationState: string;
  transcript: string;
  reservationSummary: string;
  bookingRef: string | null;
  passengerName?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langHint =
    input.language === "pt"
      ? "Portuguese"
      : input.language === "es"
        ? "Spanish"
        : input.language === "fr"
          ? "French"
          : input.language === "de"
            ? "German"
            : "English";
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: catchAllSchema,
    prompt: `You are Geotravel's WhatsApp assistant helping a passenger with their airport transfer.
Internal workflow state (do not mention literally): ${input.orchestrationState}
${passengerContextLine(input.passengerName)}
Booking ref: ${input.bookingRef ?? "unknown"}
Trip summary: ${input.reservationSummary}

Thread:
${input.transcript || "(empty)"}

Customer message:
"""${input.userMessage.slice(0, 3500)}"""

Write ONE helpful reply in ${langHint} (max ~700 characters):
- Warm, natural tone — not robotic.
- Answer what you safely can from context (pickup/destination/ref).
- If passenger name is on file, you may greet with first name once; otherwise do not invent a name.
- If you cannot answer (policy, changes, billing), say our team will confirm shortly — do not invent facts.
- Stay concise and conversational.`,
  });
  return object.reply.trim() || null;
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
