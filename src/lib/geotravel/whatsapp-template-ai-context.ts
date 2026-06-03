import {
  GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES,
  isGeotravelWhatsappLifecycleTemplate,
  type GeotravelWhatsappLifecycleTemplate,
} from "@/lib/geotravel/select-booking-whatsapp-template";

export type WhatsappTemplateConversationPhase =
  | GeotravelWhatsappLifecycleTemplate
  | "booking_confirmation"
  | "unknown";

export type WhatsappTemplateConversationContext = {
  phase: WhatsappTemplateConversationPhase;
  metaTemplateName: string | null;
  /** Operational field collection (passengers, luggage, etc.) — not for cancel / post-trip. */
  allowsOperationalEnrichment: boolean;
  /** Injected into OpenAI prompts so replies match the last template the customer saw. */
  aiInstructions: string;
};

const LIFECYCLE_PHASE_INSTRUCTIONS: Record<
  GeotravelWhatsappLifecycleTemplate,
  string
> = {
  welcome_1: `Context: The customer just received the early welcome (welcome_1) — booking is confirmed and registered; operator, platform (OTA), booking reference and pickup datetime were in the message. We said we will contact them again about 72 hours before travel and optionally invited their email.

Your reply should:
- Sound like a real Geotravel coordinator continuing that message, not a new conversation from scratch.
- Acknowledge what they wrote (thanks, ok, questions, email, etc.) before anything else.
- If they share an email, thank them briefly — do not ask for it again.
- If they ask about the trip, answer only from reservation context you have; do not invent times, prices, or policies.
- You may answer light pre-trip questions; do not start a full luggage/passenger questionnaire unless they ask or we are in an active enrichment flow.
- Do NOT say the booking is cancelled. Do NOT push marketing consent yet.`,

  welcome_2: `Context: The customer just received welcome_2 — same confirmation as welcome_1 but pickup is within ~72 hours (soon). The message said we will contact them shortly before pickup and invited their email.

Your reply should:
- Be concise and practical — pickup is approaching.
- Acknowledge their message first; use first name once if on file.
- Help with last-minute questions (pickup point, timing, contact) only from known reservation facts.
- If they provide email, acknowledge it; do not re-ask.
- You may naturally collect missing operational details if the conversation calls for it, but do not dump a rigid checklist.
- Do NOT discuss cancellation unless they raise it. Do NOT treat the trip as already completed.`,

  data: `Context: The customer just received the final pre-pickup "data" template (within ~48h of pickup). It named operator, platform, pickup/dropoff cities, datetime, and asked them to confirm: passenger count, cabin luggage, checked luggage, and extras (baby seat, booster, bike, golf, sports gear, pet box, pushchair, wheelchair, other).

Your reply should:
- Treat their message as answers and/or questions about that checklist — parse numbers and extras from natural language.
- If they gave partial info, thank them and ask only for what is still missing (one topic at a time in a conversational way).
- If they sent everything in one message, confirm receipt warmly; do not re-ask fields they already gave.
- Focus on driver/vehicle preparation (passengers, bags, special equipment, mobility needs).
- Do NOT repeat the entire template body. Do NOT say the booking is cancelled.
- Do NOT promise vehicle make/model or exact pickup minute unless in reservation data.`,

  canceled: `Context: The customer just received the CANCELLATION notice — their reservation was registered as cancelled in our system (operator, platform, ref, pickup time were in the message).

Your reply should:
- Be empathetic and brief; acknowledge cancellation if they comment on it.
- Do NOT ask them to confirm the reservation, pickup time, passenger counts, luggage, extras, or marketing consent.
- Do NOT upsell, imply the transfer is still happening, or ask operational enrichment questions.
- If they ask why, refunds, rebooking, or a new transfer: say our team will help shortly — do NOT invent amounts, deadlines, or policies.
- If they only say thanks/ok, a short sympathetic acknowledgement is enough.`,

  satisfaction: `Context: The customer just received the POST-TRIP satisfaction message — pickup time has passed; we thanked them for travelling with Geotravel and invited feedback on how the journey went.

Your reply should:
- Thank them for their message and engage with feedback (positive or negative) with genuine empathy.
- If they praise the service, acknowledge warmly without being over the top.
- If they report a problem, apologize briefly and say the team will follow up — do not argue or blame.
- Do NOT ask to confirm an upcoming booking, pickup time, passenger counts, luggage, or marketing consent.
- Do NOT push a new booking unless they ask; a soft "happy to help with a future transfer" is enough if they ask about rebooking.`,
};

const BOOKING_CONFIRM_INSTRUCTIONS = `Context: The customer just received a booking_confirmation / outreach template — a short hello with their first name from Geotravel, offering help with their transfer.

Your reply should:
- Welcome them naturally and respond to what they actually wrote (question, confirmation, concern).
- If they confirm details or say yes/no, respect that intent and guide next steps calmly.
- If they ask something specific, answer from reservation context only; otherwise offer that the team can clarify.
- Do not recite the full template; do not invent booking facts.`;

const UNKNOWN_PHASE_INSTRUCTIONS = `No specific lifecycle template is on file for the last outbound message.

Reply as Geotravel's transfer assistant: acknowledge the customer, use reservation context when relevant, do not invent facts, and stay concise. If the thread suggests a cancelled trip or completed trip, follow the customer's lead — do not ask operational questions inappropriate to that situation.`;

export function resolvePhaseFromMetaTemplateName(
  metaTemplateName: string | null | undefined,
): WhatsappTemplateConversationPhase {
  const name = metaTemplateName?.trim();
  if (!name) return "unknown";
  if (isGeotravelWhatsappLifecycleTemplate(name)) return name;
  if (name === "booking_confirmation" || name === "booking_confirm") {
    return "booking_confirmation";
  }
  const lower = name.toLowerCase();
  for (const phase of GEOTRAVEL_WHATSAPP_LIFECYCLE_TEMPLATES) {
    if (lower.includes(phase)) return phase;
  }
  return "unknown";
}

/** Parse stored outbound body from execute-geotravel-welcome-send. */
export function parseStoredOutboundTemplatePhase(
  messageBody: string | null | undefined,
): WhatsappTemplateConversationPhase | null {
  const m = (messageBody ?? "").match(
    /^\[WhatsApp template:\s*([^\]\n]+)\]/i,
  );
  if (!m) return null;
  return resolvePhaseFromMetaTemplateName(m[1].trim());
}

export function allowsOperationalEnrichmentForPhase(
  phase: WhatsappTemplateConversationPhase,
): boolean {
  return (
    phase === "welcome_1" ||
    phase === "welcome_2" ||
    phase === "data" ||
    phase === "booking_confirmation"
  );
}

export function buildWhatsappTemplateAiInstructions(
  phase: WhatsappTemplateConversationPhase,
): string {
  if (phase === "unknown") {
    return UNKNOWN_PHASE_INSTRUCTIONS;
  }
  if (phase === "booking_confirmation") {
    return BOOKING_CONFIRM_INSTRUCTIONS;
  }
  return LIFECYCLE_PHASE_INSTRUCTIONS[phase];
}

export function buildWhatsappTemplateConversationContext(input: {
  phase: WhatsappTemplateConversationPhase;
  metaTemplateName?: string | null;
}): WhatsappTemplateConversationContext {
  const phase = input.phase;
  return {
    phase,
    metaTemplateName: input.metaTemplateName?.trim() || null,
    allowsOperationalEnrichment: allowsOperationalEnrichmentForPhase(phase),
    aiInstructions: buildWhatsappTemplateAiInstructions(phase),
  };
}
