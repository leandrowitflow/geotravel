import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  nextLifecyclePhaseToSend,
  satisfactionDelayHours,
} from "./lifecycle-automation-schedule";
import { HOURS_BEFORE_DATA } from "./select-booking-whatsapp-template";

function booking(
  partial: Partial<GeotravelBooking> & { pickup_date_time?: string | null },
): GeotravelBooking {
  return {
    id: 1,
    outcome: "Active",
    status: "CONFIRMED",
    passenger_phone: "966915976",
    ...partial,
  } as GeotravelBooking;
}

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("nextLifecyclePhaseToSend (automation schedule)", () => {
  it("returns welcome_1 when pickup >72h away", () => {
    const b = booking({ pickup_date_time: "2026-05-23T12:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, new Set(), now)).toBe("welcome_1");
  });

  it("returns welcome_2 between 48h and 72h", () => {
    const b = booking({ pickup_date_time: "2026-05-21T14:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, new Set(), now)).toBe("welcome_2");
  });

  it(`returns welcome_2 first inside ${HOURS_BEFORE_DATA}h window`, () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, new Set(), now)).toBe("welcome_2");
  });

  it(`returns data after welcome inside ${HOURS_BEFORE_DATA}h window`, () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, new Set(["welcome_2"]), now)).toBe(
      "data",
    );
  });

  it("returns canceled when booking cancelled", () => {
    const b = booking({
      outcome: "Cancelled",
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(nextLifecyclePhaseToSend(b, new Set(), now)).toBe("canceled");
  });

  it("returns null for satisfaction before delay after dropoff", () => {
    const b = booking({
      pickup_date_time: "2026-05-19T10:00:00.000Z",
      dropoff_date_time: "2026-05-19T11:00:00.000Z",
    });
    expect(
      nextLifecyclePhaseToSend(b, new Set(["welcome_1", "data"]), now),
    ).toBeNull();
  });

  it("returns satisfaction after dropoff delay", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T10:00:00.000Z",
      dropoff_date_time: "2026-05-18T12:00:00.000Z",
    });
    expect(
      nextLifecyclePhaseToSend(b, new Set(["welcome_1", "data"]), now),
    ).toBe("satisfaction");
  });

  it("returns satisfaction one month after pickup without dropoff", () => {
    const b = booking({ pickup_date_time: "2026-04-19T12:00:00.000Z" });
    expect(
      nextLifecyclePhaseToSend(b, new Set(["welcome_1", "data"]), now),
    ).toBe("satisfaction");
  });
});

describe("satisfactionDelayHours", () => {
  it("defaults to 24h", () => {
    const prev = process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS;
    delete process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS;
    expect(satisfactionDelayHours()).toBe(24);
    if (prev !== undefined) {
      process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS = prev;
    }
  });
});
