import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { lifecyclePhaseForFirstAutomatedSend } from "./run-lifecycle-whatsapp-automation";
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

describe("lifecyclePhaseForFirstAutomatedSend", () => {
  it("returns welcome_1 when pickup >72h away", () => {
    const b = booking({ pickup_date_time: "2026-05-23T12:00:00.000Z" });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBe("welcome_1");
  });

  it("returns welcome_2 between 48h and 72h", () => {
    const b = booking({ pickup_date_time: "2026-05-21T14:00:00.000Z" });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBe("welcome_2");
  });

  it(`returns data within ${HOURS_BEFORE_DATA}h of pickup`, () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBe("data");
  });

  it("returns canceled when booking cancelled", () => {
    const b = booking({
      outcome: "Cancelled",
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBe("canceled");
  });

  it("returns null for satisfaction before delay after pickup", () => {
    const b = booking({ pickup_date_time: "2026-05-19T11:00:00.000Z" });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBeNull();
  });

  it("returns satisfaction after pickup delay", () => {
    const b = booking({ pickup_date_time: "2026-05-18T12:00:00.000Z" });
    expect(lifecyclePhaseForFirstAutomatedSend(b, now)).toBe("satisfaction");
  });
});
