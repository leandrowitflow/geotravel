import { describe, expect, it, vi, afterEach } from "vitest";
import { isQuietHourNow } from "./quiet-hours";

describe("quiet-hours", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.QUIET_HOURS_START_HOUR;
    delete process.env.QUIET_HOURS_END_HOUR;
  });

  it("is quiet when local hour is inside configured window", () => {
    process.env.QUIET_HOURS_START_HOUR = "10";
    process.env.QUIET_HOURS_END_HOUR = "12";
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(10);
    expect(isQuietHourNow()).toBe(true);
  });

  it("is not quiet outside configured window", () => {
    process.env.QUIET_HOURS_START_HOUR = "10";
    process.env.QUIET_HOURS_END_HOUR = "12";
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(14);
    expect(isQuietHourNow()).toBe(false);
  });
});
