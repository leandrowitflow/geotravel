import type { CollectedDataJson } from "@/db/schema";
import type { SupportedLanguage } from "@/lib/contracts/extraction";

const FIELD_ORDER = [
  "passenger_count_actual",
  "children_count",
  "special_luggage_present",
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
  special_luggage_present: {
    en: "Will you have any special luggage (golf equipment, sports gear, pushchair, wheelchair, or oversized items)?",
    pt: "Terá bagagem especial (equipamento de golfe, material desportivo, carrinho de bebé, cadeira de rodas ou volume extra)?",
    es: "¿Equipaje especial (golf, deportes, carrito, silla de ruedas, gran tamaño)?",
    fr: "Bagages spéciaux (golf, sport, poussette, fauteuil, surdimensionné) ?",
    de: "Besonderes Gepäck (Golf, Sport, Kinderwagen, Rollstuhl, übergroß)?",
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
    if (
      key === "special_luggage_present" &&
      d.special_luggage_present == null
    ) {
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
