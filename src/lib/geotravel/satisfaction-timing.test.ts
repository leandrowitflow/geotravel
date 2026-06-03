import { describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  hoursUntilSatisfactionDue,
  isSatisfactionDue,
  resolveSatisfactionDueMs,
  satisfactionMonthsAfterPickupFallback,
} from "./satisfaction-timing";

function booking(partial: Partial<GeotravelBooking>): GeotravelBooking {
  return { id: 1, ...partial } as GeotravelBooking;
}

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("satisfaction without dropoff", () => {
  it("is due one calendar month after pickup", () => {
    const b = booking({ pickup_date_time: "2026-04-19T12:00:00.000Z" });
    expect(isSatisfactionDue(b, now)).toBe(true);
  });

  it("is not due before one month after pickup", () => {
    const b = booking({ pickup_date_time: "2026-04-20T12:00:00.000Z" });
    expect(isSatisfactionDue(b, now)).toBe(false);
  });

  it("does not treat recent pickup as satisfaction", () => {
    const b = booking({ pickup_date_time: "2026-05-19T10:00:00.000Z" });
    expect(isSatisfactionDue(b, now)).toBe(false);
  });
});

describe("satisfaction with dropoff", () => {
  it("waits 24h after dropoff by default", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T10:00:00.000Z",
      dropoff_date_time: "2026-05-19T11:00:00.000Z",
    });
    expect(isSatisfactionDue(b, now)).toBe(false);
  });

  it("is due 24h after dropoff", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T10:00:00.000Z",
      dropoff_date_time: "2026-05-18T12:00:00.000Z",
    });
    expect(isSatisfactionDue(b, now)).toBe(true);
  });
});

describe("resolveSatisfactionDueMs", () => {
  it("uses pickup + one month when dropoff is missing", () => {
    const due = resolveSatisfactionDueMs(
      booking({ pickup_date_time: "2026-04-19T12:00:00.000Z" }),
    );
    expect(due).toBe(Date.parse("2026-05-19T12:00:00.000Z"));
  });
});

describe("satisfactionMonthsAfterPickupFallback", () => {
  it("defaults to 1", () => {
    const prev = process.env.GEOTRAVEL_SATISFACTION_MONTHS_AFTER_PICKUP;
    delete process.env.GEOTRAVEL_SATISFACTION_MONTHS_AFTER_PICKUP;
    expect(satisfactionMonthsAfterPickupFallback()).toBe(1);
    if (prev !== undefined) {
      process.env.GEOTRAVEL_SATISFACTION_MONTHS_AFTER_PICKUP = prev;
    }
  });
});

describe("hoursUntilSatisfactionDue", () => {
  it("is negative when due", () => {
    const h = hoursUntilSatisfactionDue(
      booking({ pickup_date_time: "2026-04-19T12:00:00.000Z" }),
      now,
    );
    expect(h).not.toBeNull();
    expect(h!).toBeLessThanOrEqual(0);
  });
});
