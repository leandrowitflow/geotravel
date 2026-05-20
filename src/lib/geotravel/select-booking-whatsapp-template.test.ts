import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  hoursUntilPickup,
  selectBookingWhatsappTemplate,
} from "./select-booking-whatsapp-template";

function booking(
  partial: Partial<GeotravelBooking> & { pickup_date_time?: string | null },
): GeotravelBooking {
  return {
    id: 1,
    outcome: "Active",
    status: "CONFIRMED",
    ...partial,
  } as GeotravelBooking;
}

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("selectBookingWhatsappTemplate", () => {
  it("uses welcome_1 when more than 72h until pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).templateName).toBe("welcome_1");
  });

  it("uses welcome_2 when between 24h and 72h until pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-21T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).templateName).toBe("welcome_2");
  });

  it("uses data within 24h of pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-20T06:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).templateName).toBe("data");
  });

  it("uses canceled when booking is cancelled", () => {
    const b = booking({
      outcome: "Cancelled",
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).templateName).toBe("canceled");
  });

  it("uses satisfaction after pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).templateName).toBe(
      "satisfaction",
    );
  });
});

describe("hoursUntilPickup", () => {
  it("returns negative after pickup", () => {
    const h = hoursUntilPickup(
      booking({ pickup_date_time: "2026-05-18T12:00:00.000Z" }),
      now,
    );
    expect(h).not.toBeNull();
    expect(h!).toBeLessThan(0);
  });
});
