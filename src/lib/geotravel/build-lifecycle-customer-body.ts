import { renderWhatsappTemplateCustomerBody } from "@/lib/admin/whatsapp-template-display";

/** Passenger-visible text for a lifecycle phase (full WhatsApp template body). */
export function buildLifecycleCustomerBody(input: {
  templateName: string;
  templateVariables?: Record<string, string>;
  languageCode: string;
}): string | null {
  return renderWhatsappTemplateCustomerBody({
    templateName: input.templateName,
    variables: input.templateVariables,
    languageCode: input.languageCode,
  });
}

export function formatStoredLifecycleTemplateMessage(input: {
  templateName: string;
  templateVariables?: Record<string, string>;
}): string {
  const vars = input.templateVariables ?? {};
  const lines = Object.entries(vars).map(([k, v]) => `${k}: ${v}`);
  return lines.length > 0
    ? `[WhatsApp template: ${input.templateName}]\n${lines.join("\n")}`
    : `[WhatsApp template: ${input.templateName}]`;
}
