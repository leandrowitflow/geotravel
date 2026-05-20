import { describe, expect, it } from "vitest";
import {
  formatMessageForConversation,
  parseStoredWhatsappTemplateMessage,
  renderWhatsappTemplateCustomerBody,
} from "./whatsapp-template-display";

describe("renderWhatsappTemplateCustomerBody", () => {
  it("renders data template with cities filled in", () => {
    const text = renderWhatsappTemplateCustomerBody({
      templateName: "data",
      languageCode: "en",
      variables: {
        operator: "Geotravel",
        plateform: "Booking.com",
        pickup_city: "Lisbon, Airport",
        dropoff_city: "Cascais, Hotel",
        pickup_date_time: "15 Jun 2026, 10:30",
      },
    });
    expect(text).toContain("Lisbon, Airport");
    expect(text).toContain("Cascais, Hotel");
    expect(text).toContain("Number of passengers:");
    expect(text).not.toContain("{{pickup_city}}");
  });
});

describe("formatMessageForConversation", () => {
  it("replaces stored template dump with customer-visible text", () => {
    const stored = `[WhatsApp template: data]
operator: Geotravel
plateform: Booking.com
pickup_city: Lisbon
dropoff_city: Cascais
pickup_date_time: 15 Jun 2026, 10:30`;

    const display = formatMessageForConversation({
      direction: "outbound",
      body: stored,
      metadata: null,
      preferredLanguage: "en",
    });

    expect(display.isWhatsappTemplate).toBe(true);
    expect(display.templateLabel).toBe("Trip details request");
    expect(display.body).toContain("Lisbon");
    expect(display.body).not.toMatch(/^operator:/m);
  });

  it("prefers metadata customer_display_body when present", () => {
    const display = formatMessageForConversation({
      direction: "outbound",
      body: "[WhatsApp template: data]\noperator: X",
      metadata: { customer_display_body: "Hello from cache" },
    });
    expect(display.body).toBe("Hello from cache");
  });
});

describe("parseStoredWhatsappTemplateMessage", () => {
  it("parses key-value lines after header", () => {
    const parsed = parseStoredWhatsappTemplateMessage(
      "[WhatsApp template: welcome_1]\noperator: Geo\nbooking_reference: BK-1",
    );
    expect(parsed?.templateName).toBe("welcome_1");
    expect(parsed?.variables.operator).toBe("Geo");
    expect(parsed?.variables.booking_reference).toBe("BK-1");
  });
});
