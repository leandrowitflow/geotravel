export type MessagingChannel = "whatsapp" | "sms";

export type OutboundMessage = {
  toE164: string;
  body: string;
  channel: MessagingChannel;
  templateName?: string;
  /** e.g. en_US — defaults from WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE */
  templateLanguageCode?: string;
  templateVariables?: Record<string, string>;
  /** When true, WhatsApp may show link previews in the text bubble (Cloud API). */
  linkPreview?: boolean;
};

export type SendResult =
  | { ok: true; providerMessageId: string; channel: MessagingChannel }
  | { ok: false; error: string };
