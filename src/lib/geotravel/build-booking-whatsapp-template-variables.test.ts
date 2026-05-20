import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  buildBookingWhatsappTemplateVariables,
  formatBookingPickupDateTimeForTemplate,
} from "./build-booking-whatsapp-template-variables";

function booking(partial: Partial<GeotravelBooking>): GeotravelBooking {
  return {
    id: 42,
    plateform: "Booking.com",
    booking_reference: "BK-9001",
    pickup_date_time: "2026-06-15T10:30:00.000Z",
    pickup_city: "Lisbon",
    pickup_address: "Airport",
    dropoff_city: "Cascais",
    dropoff_address: "Hotel",
    ...partial,
  } as GeotravelBooking;
}

describe("buildBookingWhatsappTemplateVariables", () => {
  it("uses first_name only for booking_confirmation", () => {
    expect(
      buildBookingWhatsappTemplateVariables(
        booking({}),
        "booking_confirmation",
        "Maria",
      ),
    ).toEqual({ first_name: "Maria" });
  });

  it("uses no variables for satisfaction", () => {
    expect(
      buildBookingWhatsappTemplateVariables(booking({}), "satisfaction", "Maria"),
    ).toBeUndefined();
  });

  it("uses four vars for welcome_1", () => {
    const v = buildBookingWhatsappTemplateVariables(
      booking({}),
      "welcome_1",
      "Maria",
    );
    expect(v).toMatchObject({
      operator: "Geotravel",
      plateform: "Booking.com",
      booking_reference: "BK-9001",
    });
    expect(v?.pickup_date_time).toBeTruthy();
    expect(v).not.toHaveProperty("first_name");
  });

  it("adds cities for data without booking_reference (Meta template has 5 vars)", () => {
    const v = buildBookingWhatsappTemplateVariables(booking({}), "data", "Maria");
    expect(v?.pickup_city).toContain("Lisbon");
    expect(v?.dropoff_city).toContain("Cascais");
    expect(v).not.toHaveProperty("booking_reference");
    expect(Object.keys(v ?? {}).sort()).toEqual(
      [
        "dropoff_city",
        "operator",
        "pickup_city",
        "pickup_date_time",
        "plateform",
      ].sort(),
    );
  });
});

describe("formatBookingPickupDateTimeForTemplate", () => {
  it("returns dash when missing", () => {
    expect(formatBookingPickupDateTimeForTemplate(null)).toBe("—");
  });
});
