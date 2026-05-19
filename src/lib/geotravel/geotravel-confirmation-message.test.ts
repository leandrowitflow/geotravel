import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  bookingHasPilotPhone,
  buildBookingWelcomeTemplateBody,
  firstNameForBookingWelcomeTemplate,
} from "./geotravel-confirmation-message";

function bookingWithPhone(phone: string): GeotravelBooking {
  return {
    id: 1,
    passenger_phone: phone,
  } as GeotravelBooking;
}

describe("firstNameForBookingWelcomeTemplate", () => {
  it("uses first token", () => {
    expect(firstNameForBookingWelcomeTemplate("Maria Silva")).toBe("Maria");
  });

  it("falls back to there", () => {
    expect(firstNameForBookingWelcomeTemplate(null)).toBe("there");
    expect(firstNameForBookingWelcomeTemplate("   ")).toBe("there");
  });
});

describe("bookingHasPilotPhone", () => {
  it("matches 966915976 and 930478387 pilot lines", () => {
    expect(bookingHasPilotPhone(bookingWithPhone("+351 966 915 976"))).toBe(true);
    expect(bookingHasPilotPhone(bookingWithPhone("930478387"))).toBe(true);
    expect(bookingHasPilotPhone(bookingWithPhone("+351930478387"))).toBe(true);
    expect(bookingHasPilotPhone(bookingWithPhone("+351999000111"))).toBe(false);
  });
});

describe("buildBookingWelcomeTemplateBody", () => {
  it("matches welcome copy", () => {
    expect(buildBookingWelcomeTemplateBody("Maria")).toBe(
      "Hello Maria, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer. If you have any questions, just reply to this message.",
    );
  });
});
