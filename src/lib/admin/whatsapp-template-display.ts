/**
 * Approved Meta template bodies (Geotravel WABA) — keep in sync with
 * `npm run whatsapp:template-params`. Used so admin conversation view matches
 * what the customer sees on WhatsApp, not the internal `[WhatsApp template: …]` storage.
 */

export type WhatsappTemplateDisplayLanguage = "en" | "pt_PT";

const TEMPLATE_BODIES: Record<
  string,
  Partial<Record<WhatsappTemplateDisplayLanguage, string>>
> = {
  welcome_1: {
    en: `Dear Traveler, We are {{operator}} ground transportation partner of {{plateform}}. We confirm that your reservation {{booking_reference}} scheduled for {{pickup_date_time}} has been confirmed and registered in our system. We will contact you again 72 hours before the start of your trip. To improve our communication, feel free to provide us with your email address. We greatly appreciate your preference.`,
    pt_PT: `Caro(a) Cliente,

Somos a {{operator}}, parceiro de transporte terrestre da {{plateform}}. Confirmamos que a sua reserva {{booking_reference}}, agendada para {{pickup_date_time}}, está confirmada e registada no nosso sistema.

Voltaremos a entrar em contacto consigo 72 horas antes do início da sua viagem.

Para facilitar a nossa comunicação, poderá indicar-nos o seu endereço de email.

Agradecemos a sua preferência.`,
  },
  welcome_2: {
    en: `Dear Traveler, We are {{operator}} ground transportation partner of {{plateform}}. We confirm that your reservation {{booking_reference}} scheduled for {{pickup_date_time}} has been confirmed and registered in our system. We will contact you again shortly before the start of your trip. To improve our communication, feel free to provide us with your email address. We greatly appreciate your preference.`,
    pt_PT: `Caro(a) Cliente,

Somos a {{operator}}, parceiro de transporte terrestre da {{plateform}}. Confirmamos que a sua reserva {{booking_reference}}, agendada para {{pickup_date_time}}, está confirmada e registada no nosso sistema.

Voltaremos a entrar em contacto consigo pouco antes do início da sua viagem.

Para facilitar a nossa comunicação, poderá indicar-nos o seu endereço de email.

Agradecemos a sua preferência.`,
  },
  data: {
    en: `We are {{operator}}, a ground transportation partner of {{plateform}}, and we will be providing your transfer from {{pickup_city}} to {{dropoff_city}}, scheduled for {{pickup_date_time}}.

To help us organize your service, please confirm:

Number of passengers:
Cabin luggage:
Checked luggage:
Any extras? Baby seat, booster seat, bicycle, golf bag, sports equipment, pet box, pushchair, wheelchair, or other.

Thank you. Your confirmation helps us prepare the right vehicle and equipment for your trip.`,
    pt_PT: `Caro(a) Cliente,

Somos a {{operator}}, parceiro de transporte terrestre da {{plateform}}, e iremos assegurar o seu transfer de {{pickup_city}} para {{dropoff_city}}, agendado para {{pickup_date_time}}.

Para podermos organizar o serviço da melhor forma, agradecemos que nos confirme os seguintes dados:

Número de passageiros:
Bagagem de mão:
Bagagem de porão:
Necessita de algum extra? Cadeira de bebé, assento elevatório, bicicleta, saco de golfe, equipamento desportivo, caixa de transporte para animal de estimação, carrinho de bebé, cadeira de rodas ou outro.

Obrigado. A sua confirmação ajuda-nos a preparar a viatura e os equipamentos adequados para a sua viagem.`,
  },
  canceled: {
    en: `Dear Traveler, We are {{operator}} ground transportation partner of {{plateform}}. We confirm that the cancellation of your reservation {{booking_reference}} scheduled for {{pickup_date_time}} has been registered in our system. For future inquiries about our services, feel free to provide us with your email address. We greatly appreciate your preference and look forward to hearing from you again soon.`,
    pt_PT: `Caro(a) Cliente,

Somos a {{operator}}, parceiro de transporte terrestre da {{plateform}}. Confirmamos que o cancelamento da sua reserva {{booking_reference}}, prevista para {{pickup_date_time}}, ficou registado no nosso sistema.

Caso pretenda contactar-nos futuramente sobre os nossos serviços, poderá indicar-nos o seu endereço de email.

Agradecemos a sua preferência e esperamos poder voltar a servi-lo(a) em breve.`,
  },
  satisfaction: {
    en: `Dear Traveler, thank you for choosing Geotravel for your ground transportation.

We hope you had a smooth and comfortable journey with us. We'd be happy to hear how everything went and if there's anything we could do better next time.

Your feedback means a lot to us and helps us keep improving our service.

Thank you for traveling with Geotravel.`,
    pt_PT: `Dear Traveler, thank you for choosing Geotravel for your ground transportation.

We hope you had a smooth and comfortable journey with us. We'd be happy to hear how everything went and if there's anything we could do better next time.

Your feedback means a lot to us and helps us keep improving our service.

Thank you for traveling with Geotravel.`,
  },
  booking_confirmation: {
    en: `Hello {{first_name}}, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer. If you have any questions, just reply to this message.`,
  },
  booking_confirm: {
    en: `Hello {{first_name}}, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer. If you have any questions, just reply to this message.`,
  },
};

export function normalizeTemplateDisplayLanguage(
  code: string | null | undefined,
): WhatsappTemplateDisplayLanguage {
  const c = (code ?? "").trim().toLowerCase();
  if (c === "pt" || c === "pt_pt" || c.startsWith("pt")) return "pt_PT";
  return "en";
}

export function interpolateWhatsappTemplateBody(
  shell: string,
  variables: Record<string, string>,
): string {
  return shell.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = variables[key];
    return v != null && String(v).trim() !== "" ? String(v).trim() : "—";
  });
}

export function getWhatsappTemplateShell(
  templateName: string,
  language: WhatsappTemplateDisplayLanguage,
): string | null {
  const name = templateName.trim();
  const row = TEMPLATE_BODIES[name];
  if (!row) return null;
  return row[language] ?? row.en ?? null;
}

export function parseStoredWhatsappTemplateMessage(body: string): {
  templateName: string;
  variables: Record<string, string>;
} | null {
  const m = body.match(/^\[WhatsApp template:\s*([^\]\n]+)\]/i);
  if (!m) return null;
  const templateName = m[1].trim();
  const rest = body.slice(m[0].length).replace(/^\n/, "");
  const variables: Record<string, string> = {};
  for (const line of rest.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      variables[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
  }
  return { templateName, variables };
}

export function isStoredWhatsappTemplateMessage(body: string): boolean {
  return body.startsWith("[WhatsApp template:");
}

export function renderWhatsappTemplateCustomerBody(input: {
  templateName: string;
  variables?: Record<string, string>;
  languageCode?: string | null;
}): string | null {
  const lang = normalizeTemplateDisplayLanguage(input.languageCode);
  const shell = getWhatsappTemplateShell(input.templateName, lang);
  if (!shell) return null;
  const vars = input.variables ?? {};
  return interpolateWhatsappTemplateBody(shell, vars);
}

export function templateDisplayLabel(templateName: string): string {
  const labels: Record<string, string> = {
    welcome_1: "Welcome (72h+)",
    welcome_2: "Welcome (<72h)",
    data: "Trip details request",
    canceled: "Cancellation",
    satisfaction: "Post-trip feedback",
    booking_confirmation: "Booking confirmation",
    booking_confirm: "Booking confirmation",
  };
  return labels[templateName] ?? templateName.replace(/_/g, " ");
}

export type ConversationMessageDisplay = {
  body: string;
  isWhatsappTemplate: boolean;
  templateName?: string;
  templateLabel?: string;
  templateLanguage?: string;
};

/**
 * Text shown in admin conversation UI — customer-visible wording for templates.
 */
export function formatMessageForConversation(input: {
  direction: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  preferredLanguage?: string | null;
}): ConversationMessageDisplay {
  const meta = input.metadata ?? {};
  const metaLang =
    typeof meta.template_language === "string" ? meta.template_language : null;
  const lang =
    metaLang ??
    (input.preferredLanguage?.toLowerCase().startsWith("pt") ? "pt_PT" : "en");

  const storedDisplay =
    typeof meta.customer_display_body === "string"
      ? meta.customer_display_body.trim()
      : "";
  if (storedDisplay) {
    const templateName =
      typeof meta.meta_template_name === "string"
        ? meta.meta_template_name
        : typeof meta.lifecycle_phase === "string"
          ? meta.lifecycle_phase
          : undefined;
    return {
      body: storedDisplay,
      isWhatsappTemplate: true,
      templateName,
      templateLabel: templateName ? templateDisplayLabel(templateName) : undefined,
      templateLanguage: lang,
    };
  }

  if (
    input.direction === "outbound" &&
    isStoredWhatsappTemplateMessage(input.body)
  ) {
    const parsed = parseStoredWhatsappTemplateMessage(input.body);
    if (!parsed) {
      return { body: input.body, isWhatsappTemplate: false };
    }

    const metaVars =
      meta.template_variables &&
      typeof meta.template_variables === "object" &&
      !Array.isArray(meta.template_variables)
        ? (meta.template_variables as Record<string, string>)
        : parsed.variables;

    const rendered = renderWhatsappTemplateCustomerBody({
      templateName: parsed.templateName,
      variables: metaVars,
      languageCode: lang,
    });

    return {
      body:
        rendered ??
        `(${templateDisplayLabel(parsed.templateName)} — template text unavailable)\n\n${Object.entries(metaVars)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`,
      isWhatsappTemplate: true,
      templateName: parsed.templateName,
      templateLabel: templateDisplayLabel(parsed.templateName),
      templateLanguage: lang,
    };
  }

  return { body: input.body, isWhatsappTemplate: false };
}
