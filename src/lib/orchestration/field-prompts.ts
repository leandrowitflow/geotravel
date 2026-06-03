import type { CollectedDataJson } from "@/db/schema";
import type { SupportedLanguage } from "@/lib/contracts/extraction";

const FIELD_ORDER = [
  "passenger_count_actual",
  "children_count",
  "cabin_luggage",
  "checked_luggage",
  "extras",
  "reduced_mobility_present",
  "additional_notes",
] as const;

export type FieldKey = (typeof FIELD_ORDER)[number];

const COPY: Record<
  FieldKey,
  Record<SupportedLanguage, string>
> = {
  passenger_count_actual: {
    en: "How many passengers will be travelling, including any children?",
    pt: "Quantos passageiros irão viajar, incluindo crianças?",
    es: "¿Cuántas personas viajarán, incluidos los niños?",
    fr: "Combien de passagers voyagent, enfants inclus ?",
    de: "Wie viele Personen reisen mit, Kinder eingeschlossen?",
  },
  children_count: {
    en: "How many children will be travelling, and what are their ages?",
    pt: "Quantas crianças irão viajar e quais as respetivas idades?",
    es: "¿Cuántos niños y qué edades tienen?",
    fr: "Combien d’enfants et quel âge ont-ils ?",
    de: "Wie viele Kinder und welches Alter?",
  },
  cabin_luggage: {
    en: "How many pieces of cabin (hand) luggage will you have?",
    pt: "Quantas peças de bagagem de cabine terá?",
    es: "¿Cuántas piezas de equipaje de mano?",
    fr: "Combien de bagages cabine ?",
    de: "Wie viele Handgepäckstücke?",
  },
  checked_luggage: {
    en: "How many checked (hold) suitcases will you have?",
    pt: "Quantas malas de porão (bagagem de porão) terá?",
    es: "¿Cuántas maletas facturadas?",
    fr: "Combien de bagages en soute ?",
    de: "Wie viele Aufgabegepäckstücke?",
  },
  extras: {
    en: "Any extras? Baby seat, booster seat, bicycle, golf bag, sports equipment, pet box, pushchair, wheelchair, or other — please list or say none.",
    pt: "Algum extra? Cadeira de bebé, booster, bicicleta, golfe, material desportivo, caixa para animal, carrinho, cadeira de rodas ou outro — indique ou diga que não tem.",
    es: "¿Algún extra? Silla de bebé, elevador, bicicleta, golf, deporte, mascota, carrito, silla de ruedas u otro.",
    fr: "Extras ? Siège bébé, réhausseur, vélo, golf, sport, animal, poussette, fauteuil, autre.",
    de: "Extras? Babysitz, Sitzerhöhung, Fahrrad, Golf, Sport, Tierbox, Kinderwagen, Rollstuhl oder anderes.",
  },
  reduced_mobility_present: {
    en: "Are there any reduced mobility requirements we should pass to the driver?",
    pt: "Existem necessidades de mobilidade reduzida que devamos comunicar ao motorista?",
    es: "¿Necesidades de movilidad reducida para el conductor?",
    fr: "Besoins de mobilité réduite à transmettre au chauffeur ?",
    de: "Eingeschränkte Mobilität für den Fahrer relevant?",
  },
  additional_notes: {
    en: "Is there anything further we should note for this transfer?",
    pt: "Há mais alguma informação que devamos registar para este transfer?",
    es: "¿Algo más que debamos saber para este traslado?",
    fr: "Autre chose à savoir pour ce transfert ?",
    de: "Noch etwas Wichtiges für diesen Transfer?",
  },
};

function cabinLuggageComplete(d: CollectedDataJson): boolean {
  return (
    d.cabin_luggage_pieces != null ||
    Boolean(d.cabin_luggage_notes?.trim())
  );
}

function checkedLuggageComplete(d: CollectedDataJson): boolean {
  return (
    d.checked_luggage_pieces != null ||
    Boolean(d.checked_luggage_notes?.trim())
  );
}

function extrasComplete(d: CollectedDataJson): boolean {
  if (d.extras_none_confirmed === true) return true;
  if (d.extras_items != null) return true;
  if (Boolean(d.extras_notes?.trim())) return true;
  return false;
}

export function nextMissingField(
  data: CollectedDataJson | null | undefined,
): FieldKey | null {
  const d = data ?? {};
  for (const key of FIELD_ORDER) {
    if (key === "passenger_count_actual" && d.passenger_count_actual == null) {
      return key;
    }
    if (key === "children_count" && d.children_count == null) {
      return key;
    }
    if (key === "cabin_luggage" && !cabinLuggageComplete(d)) {
      return key;
    }
    if (key === "checked_luggage" && !checkedLuggageComplete(d)) {
      return key;
    }
    if (key === "extras" && !extrasComplete(d)) {
      return key;
    }
    if (
      key === "reduced_mobility_present" &&
      d.reduced_mobility_present == null
    ) {
      return key;
    }
    if (key === "additional_notes" && d.additional_notes == null) {
      return key;
    }
  }
  return null;
}

export function promptForField(
  field: FieldKey,
  lang: SupportedLanguage,
): string {
  return COPY[field][lang] ?? COPY[field].en;
}

/** Internal intent for AI — not sent verbatim to customers. */
const FIELD_INTENT_EN: Record<FieldKey, string> = {
  passenger_count_actual:
    "the total number of passengers travelling (adults and children combined)",
  children_count:
    "how many children are travelling and each child's age (needed for child seats)",
  cabin_luggage:
    "how many pieces of hand/cabin luggage they will bring",
  checked_luggage:
    "how many checked/hold suitcases they will bring",
  extras:
    "whether they need special equipment: baby seat, booster, bicycle, golf bag, sports gear, pet transport box, pushchair/stroller, wheelchair, or other — or confirm they need none",
  reduced_mobility_present:
    "whether anyone has reduced mobility needs the driver should know about",
  additional_notes:
    "any other practical detail for the driver (flight number, meet point, special instructions)",
};

export function fieldIntentForAi(field: FieldKey): string {
  return FIELD_INTENT_EN[field];
}

/** Maps orchestration pending_field_key to prompt copy key. */
export function promptForFieldKey(
  fieldKey: string,
  lang: SupportedLanguage,
): string {
  if ((FIELD_ORDER as readonly string[]).includes(fieldKey)) {
    return promptForField(fieldKey as FieldKey, lang);
  }
  return promptForField("additional_notes", lang);
}
