import { describe, expect, it } from "vitest";
import {
  buildLifecycleSmsBody,
  SMS_LIFECYCLE_MAX_CHARS,
  SMS_LIFECYCLE_TEMPLATE_NAMES,
} from "./build-lifecycle-sms-body";

const SAMPLE_VARS: Record<string, Record<string, string>> = {
  welcome_1: {
    operator: "Geotravel",
    plateform: "Booking.com",
    booking_reference: "900017",
    pickup_date_time: "1 May 2026, 10:00",
  },
  welcome_2: {
    operator: "Geotravel",
    plateform: "Booking.com",
    booking_reference: "900017",
    pickup_date_time: "1 May 2026, 10:00",
  },
  data: {
    operator: "Geotravel",
    plateform: "Booking.com",
    pickup_city: "Lisbon",
    dropoff_city: "Cascais",
    pickup_date_time: "1 May 2026, 10:00",
  },
  canceled: {
    operator: "Geotravel",
    plateform: "Booking.com",
    booking_reference: "900017",
    pickup_date_time: "1 May 2026, 10:00",
  },
  satisfaction: {
    operator: "Geotravel",
    plateform: "Booking.com",
  },
  booking_confirmation: {
    first_name: "Ana",
    operator: "Geotravel",
  },
  booking_confirm: {
    first_name: "Ana",
    operator: "Geotravel",
  },
};

describe("buildLifecycleSmsBody", () => {
  for (const templateName of SMS_LIFECYCLE_TEMPLATE_NAMES) {
    it(`${templateName} PT fits SMS budget`, () => {
      const vars =
        SAMPLE_VARS[templateName as keyof typeof SAMPLE_VARS] ?? {};
      const body = buildLifecycleSmsBody({
        templateName,
        languageCode: "pt_PT",
        templateVariables: vars,
      });
      expect(body, `${templateName} missing SMS shell`).toBeTruthy();
      expect(body!.length).toBeLessThanOrEqual(SMS_LIFECYCLE_MAX_CHARS);
    });
  }

  it("welcome_1 PT includes operator and ref", () => {
    const body = buildLifecycleSmsBody({
      templateName: "welcome_1",
      languageCode: "pt_PT",
      templateVariables: SAMPLE_VARS.welcome_1,
    });
    expect(body).toContain("900017");
    expect(body).toContain("Geotravel");
  });
});
