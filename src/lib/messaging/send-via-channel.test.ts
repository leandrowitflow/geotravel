import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendInfobipSms, sendWhatsAppMessage, writeBehaviouralEvent } = vi.hoisted(
  () => ({
    sendInfobipSms: vi.fn(),
    sendWhatsAppMessage: vi.fn(),
    writeBehaviouralEvent: vi.fn(),
  }),
);

vi.mock("./infobip-sms", () => ({ sendInfobipSms }));
vi.mock("./meta-whatsapp", () => ({ sendWhatsAppMessage }));
vi.mock("@/lib/events/write-behavioural-event", () => ({
  writeBehaviouralEvent,
}));

import { sendViaPreferredChannel } from "./send-via-channel";

describe("sendViaPreferredChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendInfobipSms.mockResolvedValue({
      ok: true,
      providerMessageId: "sms-1",
      channel: "sms",
    });
    sendWhatsAppMessage.mockResolvedValue({
      ok: true,
      providerMessageId: "wa-1",
      channel: "whatsapp",
    });
    writeBehaviouralEvent.mockResolvedValue(undefined);
  });

  it("sends smsBody on direct SMS, not internal template storage body", async () => {
    await sendViaPreferredChannel({
      caseId: "c1",
      reservationId: "r1",
      preferred: "sms",
      toE164: "+351966915976",
      body: "[WhatsApp template: welcome_1]\nOlá",
      smsBody: "Olá! A sua reserva está confirmada.",
    });

    expect(sendInfobipSms).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sms",
        body: "Olá! A sua reserva está confirmada.",
      }),
    );
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });
});
