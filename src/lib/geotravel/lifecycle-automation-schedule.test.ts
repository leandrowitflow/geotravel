import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  nextLifecyclePhaseToSend,
  satisfactionDelayHours,
} from "./lifecycle-automation-schedule";
import type { GeotravelWhatsappLifecycleTemplate } from "./select-booking-whatsapp-template";

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

function sent(...phases: GeotravelWhatsappLifecycleTemplate[]) {
  return new Set(phases);
}

describe("nextLifecyclePhaseToSend", () => {
  it("sends welcome_1 when pickup is more than 72h away", () => {
    const b = booking({ pickup_date_time: "2026-05-23T12:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent(), now)).toBe("welcome_1");
  });

  it("sends welcome_2 between 48h and 72h", () => {
    const b = booking({ pickup_date_time: "2026-05-21T14:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent(), now)).toBe("welcome_2");
  });

  it("sends welcome_2 first when synced inside 48h window", () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent(), now)).toBe("welcome_2");
  });

  it("sends data after welcome when within 48h of pickup", () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_2"), now)).toBe("data");
  });

  it("does not send data before any welcome", () => {
    const b = booking({ pickup_date_time: "2026-05-20T06:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent(), now)).toBe("welcome_2");
    expect(nextLifecyclePhaseToSend(b, sent(), now)).not.toBe("data");
  });

  it("sends canceled and skips other phases when cancelled", () => {
    const b = booking({
      outcome: "Cancelled",
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(nextLifecyclePhaseToSend(b, sent(), now)).toBe("canceled");
    expect(nextLifecyclePhaseToSend(b, sent("canceled"), now)).toBeNull();
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1"), now)).toBe("canceled");
  });

  it("returns null for satisfaction before delay after dropoff", () => {
    const b = booking({
      pickup_date_time: "2026-05-19T10:00:00.000Z",
      dropoff_date_time: "2026-05-19T11:00:00.000Z",
    });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1", "data"), now)).toBeNull();
  });

  it("does not send satisfaction after pickup if dropoff is still in the future", () => {
    const b = booking({
      pickup_date_time: "2026-05-19T10:00:00.000Z",
      dropoff_date_time: "2026-05-19T14:00:00.000Z",
    });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1", "data"), now)).toBeNull();
  });

  it("sends satisfaction after default 24h past dropoff", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T10:00:00.000Z",
      dropoff_date_time: "2026-05-18T12:00:00.000Z",
    });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1", "data"), now)).toBe(
      "satisfaction",
    );
  });

  it("sends satisfaction one month after pickup when no dropoff", () => {
    const b = booking({ pickup_date_time: "2026-04-19T12:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1", "data"), now)).toBe(
      "satisfaction",
    );
  });

  it("does not send satisfaction before one month after pickup without dropoff", () => {
    const b = booking({ pickup_date_time: "2026-04-20T12:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1", "data"), now)).toBeNull();
  });

  it("does not repeat a phase already sent", () => {
    const b = booking({ pickup_date_time: "2026-05-23T12:00:00.000Z" });
    expect(nextLifecyclePhaseToSend(b, sent("welcome_1"), now)).toBeNull();
  });
});

describe("satisfactionDelayHours", () => {
  it("defaults to 24 hours", () => {
    const prev = process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS;
    delete process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS;
    expect(satisfactionDelayHours()).toBe(24);
    if (prev !== undefined) {
      process.env.GEOTRAVEL_WHATSAPP_SATISFACTION_DELAY_HOURS = prev;
    }
  });
});
