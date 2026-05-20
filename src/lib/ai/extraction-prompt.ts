import { EXTRA_ITEM_VALUES } from "@/lib/contracts/extras-items";

export function buildOperationalExtractionPrompt(
  customerMessage: string,
  prior: Record<string, unknown> | null,
): string {
  const extrasList = EXTRA_ITEM_VALUES.join(", ");
  return `You extract structured operational data from a private airport transfer customer's WhatsApp message.

Return JSON fields (use null when not mentioned or unclear). Prior values may be updated if the customer corrects them:
${JSON.stringify(prior ?? {})}

Fields to extract:
- passenger_count_actual: total passengers travelling (integer, including adults and children).
- children_count: number of children only (integer 0+), null if not mentioned.
- child_ages: array of child ages in years when mentioned.
- cabin_luggage_pieces: number of cabin / hand luggage pieces (integer 0+).
- cabin_luggage_notes: free text for cabin bags if count unclear (e.g. "2 small backpacks").
- checked_luggage_pieces: number of checked / hold suitcases (integer 0+).
- checked_luggage_notes: free text for checked luggage if unclear.
- extras_items: array of zero or more from [${extrasList}] when customer mentions baby seat, booster, bicycle, golf, sports gear, pet, pushchair/stroller, wheelchair, etc.
- extras_none_confirmed: true only if customer clearly says they have NO extras/special items.
- extras_notes: other extras not in the list.
- reduced_mobility_present: boolean if mobility assistance mentioned.
- reduced_mobility_notes: details for driver.
- additional_notes: anything else relevant for the driver.

Rules:
- Parse lists like "2 passengers, 1 cabin bag, 2 suitcases, golf bag" into the right fields.
- "No extras" / "nothing special" → extras_none_confirmed true, extras_items [].
- Do not invent counts; use notes fields when ambiguous.
- Include per-field confidence scores 0–1 in "confidence" object for fields you set.

Customer message:
"""${customerMessage.slice(0, 4000)}"""`;
}
