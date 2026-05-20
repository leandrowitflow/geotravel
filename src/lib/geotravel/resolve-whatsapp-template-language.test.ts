import { afterEach, describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { resolveWhatsappTemplateLanguage } from "./resolve-whatsapp-template-language";

function booking(phone: string): GeotravelBooking {
  return { id: 1, passenger_phone: phone } as GeotravelBooking;
}

describe("resolveWhatsappTemplateLanguage", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses pt_PT for lifecycle templates when phone is Portuguese", () => {
    expect(
      resolveWhatsappTemplateLanguage("welcome_1", {
        booking: booking("966915976"),
        destinationE164: "+351966915976",
      }),
    ).toBe("pt_PT");
  });

  it("uses en for lifecycle templates when phone is not Portuguese", () => {
    expect(
      resolveWhatsappTemplateLanguage("welcome_1", {
        booking: booking("+14155550123"),
        destinationE164: "+14155550123",
      }),
    ).toBe("en");
  });

  it("uses pt_PT for booking_confirmation on PT phone", () => {
    delete process.env.WHATSAPP_BOOKING_CONFIRM_TEMPLATE_LANGUAGE;
    expect(
      resolveWhatsappTemplateLanguage("booking_confirmation", {
        destinationE164: "+351930478387",
      }),
    ).toBe("pt_PT");
  });
});
