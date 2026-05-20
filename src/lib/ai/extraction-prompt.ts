import { EXTRA_ITEM_VALUES } from "@/lib/contracts/extras-items";

export function buildOperationalExtractionPrompt(
  customerMessage: string,
  prior: Record<string, unknown> | null,
): string {
  const extrasList = EXTRA_ITEM_VALUES.join(", ");
  return `You extract structured operational data from a private airport transfer customer's WhatsApp message.

Return JSON with every field key present (use null when not mentioned or unclear). Prior values may be updated if the customer corrects them:
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
- One message may contain SEVERAL facts — extract ALL of them (passengers + luggage + extras together).
- Portuguese (Portugal): "pessoas/passageiros" = passenger_count_actual; "crianças" = children_count only (not total pessoas).
- "Somos 4 pessoas" → passenger_count_actual 4. "com 5 malas" without cabin/hand qualifier → checked_luggage_pieces 5 (typical hold bags).
- "malas de mão" / "bagagem de cabine" → cabin_luggage_pieces; "malas de porão" → checked_luggage_pieces.
- "cadeira de bebé" / "cadeirinha" → extras_items includes "baby_seat". "precisamos de …" / "need a …" counts as requesting that extra.
- English: same logic ("4 people", "5 suitcases", "baby seat").
- "No extras" / "nada de especial" / "sem extras" → extras_none_confirmed true, extras_items [].
- Do not invent counts; use notes fields when ambiguous.
- Set only the field keys above; confidence is assigned automatically server-side.

Examples (extract every field mentioned):
- "Somos 4 pessoas, com 5 malas e precisamos de cadeira de bebé" → passenger_count_actual: 4, checked_luggage_pieces: 5, extras_items: ["baby_seat"], children_count: 0 if no children mentioned.
- "3 adults, 2 cabin bags and 1 checked suitcase, no extras" → passenger_count_actual: 3, cabin_luggage_pieces: 2, checked_luggage_pieces: 1, extras_none_confirmed: true.

Customer message:
"""${customerMessage.slice(0, 4000)}"""`;
}
