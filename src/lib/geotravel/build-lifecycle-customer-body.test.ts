import { describe, expect, it } from "vitest";
import { buildLifecycleCustomerBody } from "./build-lifecycle-customer-body";

describe("buildLifecycleCustomerBody", () => {
  it("renders welcome_1 with variables", () => {
    const body = buildLifecycleCustomerBody({
      templateName: "welcome_1",
      languageCode: "en",
      templateVariables: {
        operator: "Geotravel",
        plateform: "Booking.com",
        booking_reference: "900017",
        pickup_date_time: "1 Jan 2026, 10:00",
      },
    });
    expect(body).toContain("Geotravel");
    expect(body).toContain("900017");
    expect(body).toContain("Booking.com");
  });
});
