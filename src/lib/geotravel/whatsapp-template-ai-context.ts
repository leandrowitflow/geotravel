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
  welcome_1:
    "We just sent the early welcome template: the booking exists, operator/platform/ref and pickup time were in the message. The customer is NOT cancelled. Reply as a helpful pre-trip assistant. You may gently confirm details or answer questions about the upcoming transfer. Do not sound like a generic chatbot repeating the whole itinerary unless they ask.",
  welcome_2:
    "We just sent the <72h reminder welcome template with booking ref and pickup time. Pickup is soon. Be concise and practical. Help with last-minute questions; you may ask for missing trip details only if the scripted flow requires it. Do not discuss cancellation unless they bring it up.",
  data:
    "We just sent the final pre-pickup data template (within ~24h of pickup) including pickup/dropoff cities and datetime. Focus on imminent travel logistics and anything still needed for the driver. Do not re-read the entire booking back unless they ask. Do not treat the trip as cancelled.",
  canceled:
    "We just sent the CANCELLATION notice template. The booking is cancelled. Do NOT ask them to confirm the reservation, pickup details, passenger counts, luggage, or marketing consent. Do NOT upsell or imply the transfer is still happening. Acknowledge their message empathetically; if they ask why, refunds, or rebooking, say our team will help shortly — do not invent policies or amounts.",
  satisfaction:
    "We just sent the POST-TRIP satisfaction / feedback template after the transfer. Thank them for traveling with us. Ask how the service went or respond to their feedback. Do NOT ask to confirm an upcoming booking, pickup time, or operational details. Do NOT push new bookings unless they ask. If they report a problem, empathize and say the team will follow up.",
};

const BOOKING_CONFIRM_INSTRUCTIONS =
  "We just sent a booking confirmation template with a yes/no style check. Help them confirm or correct details naturally. If they say yes/no, respect that intent.";

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
    return "No specific WhatsApp template context is recorded. Reply helpfully about their Geotravel transfer without inventing facts.";
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
