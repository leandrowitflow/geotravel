import type { SupportedLanguage } from "@/lib/contracts/extraction";

function firstNameOrNull(customerName: string | null | undefined): string | null {
  const t = (customerName ?? "").trim();
  if (!t) return null;
  const first = t.split(/\s+/)[0];
  return first.length > 0 ? first : null;
}

function coerceOutreachLang(raw: string | null | undefined): SupportedLanguage {
  const x = (raw ?? "en").toLowerCase().slice(0, 2);
  if (x === "pt" || x === "es" || x === "fr" || x === "de") return x;
  return "en";
}

function formatTripSummary(input: {
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupDatetimeIso: string | null;
  lang: SupportedLanguage;
}): string {
  const locale =
    input.lang === "pt"
      ? "pt-PT"
      : input.lang === "es"
        ? "es-ES"
        : input.lang === "fr"
          ? "fr-FR"
          : input.lang === "de"
            ? "de-DE"
            : "en-GB";
  const routeParts: string[] = [];
  if (input.pickupLocation?.trim()) routeParts.push(input.pickupLocation.trim());
  if (input.dropoffLocation?.trim()) {
    routeParts.push(input.dropoffLocation.trim());
  }
  const route =
    routeParts.length >= 2
      ? `${routeParts[0]} → ${routeParts[1]}`
      : routeParts[0] ?? "your transfer";

  if (!input.pickupDatetimeIso) return route;
  try {
    const d = new Date(input.pickupDatetimeIso);
    if (Number.isNaN(d.getTime())) return route;
    const when = d.toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${route} · ${when}`;
  } catch {
    return route;
  }
}

/**
 * First WhatsApp/SMS after a case enters `awaiting_outreach`: warm tone, asks to
 * confirm contact + trip, passenger count, ages, and luggage (aligned with enrichment fields).
 */
export function buildInitialOutreachMessage(input: {
  customerName: string | null;
  externalBookingId: string;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  pickupDatetimeIso: string | null;
  contactPreferredLanguage: string | null | undefined;
}): string {
  const lang = coerceOutreachLang(input.contactPreferredLanguage);
  const first = firstNameOrNull(input.customerName);
  const trip = formatTripSummary({
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation,
    pickupDatetimeIso: input.pickupDatetimeIso,
    lang,
  });
  const ref = input.externalBookingId;

  if (lang === "pt") {
    const hi = first ? `Olá, ${first}!` : "Olá!";
    return [
      `${hi} Somos a equipa da Geotravel e estamos a contactá-lo sobre o seu transfer (${trip}, ref. ${ref}).`,
      "",
      "Se nos puder responder a estas confirmações rápidas, ajuda-nos a preparar tudo com o motorista:",
      "",
      "• Confirma que este WhatsApp é o melhor contacto e que os detalhes da viagem (origem, destino e hora) estão corretos?",
      "• Quantas pessoas vão no veículo, e que idades têm (incluindo crianças, ou diga se são todos adultos)?",
      "• Que tipo de bagagem vai levar (malas de porão, cabine, equipamento desportivo, carrinho de bebé, volumes extra ou especiais, etc.)?",
      "",
      "Pode responder tudo na mesma mensagem, à vontade. Obrigado!",
    ].join("\n");
  }

  if (lang === "es") {
    const hi = first ? `Hola, ${first}` : "Hola";
    return [
      `${hi}. Somos el equipo de Geotravel y le escribimos por su transfer (${trip}, ref. ${ref}).`,
      "",
      "¿Podría confirmarnos lo siguiente para coordinar con el conductor?",
      "",
      "• ¿Es este WhatsApp el mejor contacto y están bien origen, destino y hora?",
      "• ¿Cuántas personas viajan y qué edades tienen (niños incluidos, o si todos son adultos)?",
      "• ¿Qué equipaje llevan (facturado, cabina, material deportivo, carrito, piezas grandes, etc.)?",
      "",
      "Puede responder todo en un solo mensaje. ¡Gracias!",
    ].join("\n");
  }

  if (lang === "fr") {
    const hi = first ? `Bonjour ${first}` : "Bonjour";
    return [
      `${hi}, nous sommes l’équipe Geotravel pour votre transfert (${trip}, réf. ${ref}).`,
      "",
      "Pourriez-vous nous confirmer rapidement :",
      "",
      "• Ce numéro WhatsApp convient-il, et origine / destination / heure sont-ils corrects ?",
      "• Combien de personnes voyagent, et âges (enfants inclus, ou uniquement des adultes) ?",
      "• Quel type de bagages (soutes, cabine, sport, poussette, volumineux, etc.) ?",
      "",
      "Vous pouvez tout répondre dans un seul message. Merci !",
    ].join("\n");
  }

  if (lang === "de") {
    const hi = first ? `Hallo ${first}` : "Hallo";
    return [
      `${hi}, hier ist das Geotravel-Team zu Ihrem Transfer (${trip}, Ref. ${ref}).`,
      "",
      "Kurze Rückfragen für den Fahrer:",
      "",
      "• Ist diese WhatsApp-Nummer richtig, und stimmen Abholort, Ziel und Zeit?",
      "• Wie viele Personen reisen mit, und welche Alter (Kinder dabei oder nur Erwachsene)?",
      "• Welches Gepäck (Aufgabe, Hand, Sport, Kinderwagen, Sperrgut, …)?",
      "",
      "Antworten gern in einer Nachricht. Danke!",
    ].join("\n");
  }

  const hi = first ? `Hi ${first}` : "Hi there";
  return [
    `${hi} — we're Geotravel, following up about your transfer (${trip}, ref. ${ref}).`,
    "",
    "When you have a moment, could you confirm a few things so we can brief the driver?",
    "",
    "• Is this WhatsApp the best number for you, and are your pickup time and route still correct?",
    "• How many people are travelling, and what ages (including any children — or let us know if everyone is an adult)?",
    "• What luggage are you bringing (checked bags, carry-on, sports equipment, stroller, oversized or extra items, etc.)?",
    "",
    "Feel free to reply in one message. Thanks so much!",
  ].join("\n");
}
