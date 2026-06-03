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
  /** Operational field collection (passengers, luggage, etc.) — data template phase only. */
  allowsOperationalEnrichment: boolean;
  /** Injected into OpenAI prompts so replies match the last template the customer saw. */
  aiInstructions: string;
};

const LIFECYCLE_PHASE_INSTRUCTIONS: Record<
  GeotravelWhatsappLifecycleTemplate,
  string
> = {
  welcome_1: `Context: The customer just received welcome_1 — early booking confirmation (operator, platform, ref, pickup time). We will contact them again about 72 hours before travel; they may share their email.

Primary goal — GREETING & WELCOME only:
- Welcome them warmly and make them feel the booking is in good hands.
- Acknowledge what they said first (thanks, ok, a question, their email).
- Use first name once if on file; sound human, not like a form.
- If they gave an email, thank them — do not ask again.
- Answer light questions about the upcoming trip only from reservation facts you have.

Do NOT in this phase:
- Ask for passenger counts, luggage, extras, or any operational checklist (that comes later with the data template).
- Ask marketing consent, D-1 confirmation, or cancellation topics unless they raise them.
- Invent prices, refunds, policies, or vehicle details.`,

  welcome_2: `Context: The customer just received welcome_2 — booking still confirmed; pickup is within ~72 hours. We will contact them shortly before pickup; they may share their email.

Primary goal — GREETING & WELCOME only (pickup is soon but this is still a welcome touchpoint):
- Greet them kindly and reassure them we are preparing their transfer.
- Acknowledge their reply first; use first name once if on file.
- Briefly help with simple pre-trip questions (timing, pickup in general) only from known facts.
- If they share email, thank them — do not re-ask.

Do NOT in this phase:
- Run the passenger/luggage/extras questionnaire — that is reserved for the data template.
- Push operational details, marketing consent, or cancellation talk unless they bring it up.
- Treat the trip as finished or discuss satisfaction/feedback.`,

  data: `Context: The customer just received the data template (within ~48h of pickup) — transfer route, datetime, and a request to confirm passengers, cabin bags, checked bags, and extras.

Primary goal — COLLECT MISSING OPERATIONAL DATA:
- Parse their message for answers (numbers, ages, extras, mobility needs, notes).
- Thank them for what they already provided; ask only for what is still missing — one topic at a time, conversationally.
- If they gave everything, confirm we have what the driver needs.
- Clarify ambiguous answers gently (e.g. "2 bags" — cabin or checked?).

Do NOT in this phase:
- Repeat the full template text or give a long welcome speech — they already got the template.
- Ask unrelated topics (marketing consent, how the trip went, why cancelled).
- Invent pickup changes, prices, or vehicle type.`,

  canceled: `Context: The customer just received the cancellation notice — their booking is registered as cancelled in our system.

Primary goal — UNDERSTAND WHY IT WAS CANCELLED:
- Respond with empathy; acknowledge the cancellation.
- If they explain why (plans changed, flight issue, duplicate booking, price, no longer travelling, etc.), listen, reflect it back briefly, and thank them for explaining.
- If they have not said why, ask once — politely — what led them to cancel (without sounding accusatory).
- If they want help, rebooking, or refund information: say our team will follow up — do NOT invent policies or amounts.

Do NOT in this phase:
- Ask to confirm the trip, passenger counts, luggage, extras, or marketing consent.
- Imply the transfer is still happening or upsell aggressively.`,

  satisfaction: `Context: The customer just received the post-trip satisfaction message — their transfer should have taken place; we asked how the journey went.

Primary goal — GET FEEDBACK ON HOW THE TRAVEL WENT:
- Thank them for replying; show genuine interest in their experience.
- If they share how it went (good or bad), respond to that specifically — driver, punctuality, vehicle, comfort, communication.
- If feedback is vague ("ok", "fine"), invite a bit more detail once (what went well or what could improve).
- If they report a problem: empathize, apologize briefly, say the team will review — do not argue or blame.

Do NOT in this phase:
- Ask for upcoming-trip data (passengers, luggage, pickup confirmation for a future leg).
- Treat this as a new booking welcome unless they ask to book again.`,
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
  return phase === "data" || phase === "booking_confirmation";
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
