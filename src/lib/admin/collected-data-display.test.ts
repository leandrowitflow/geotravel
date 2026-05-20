import { describe, expect, it } from "vitest";
import {
  buildCollectedDataDisplayRows,
  formatExtraInformationSummary,
} from "./collected-data-display";

describe("formatExtraInformationSummary", () => {
  it("joins display rows for inbox column", () => {
    const s = formatExtraInformationSummary({
      passenger_count_actual: 4,
      checked_luggage_pieces: 5,
      extras_items: ["baby_seat"],
      children_count: 0,
    });
    expect(s).toContain("4");
    expect(s).toContain("Baby seat");
  });

  it("returns em dash when empty", () => {
    expect(formatExtraInformationSummary({})).toBe("—");
  });
});

describe("buildCollectedDataDisplayRows", () => {
  it("shows passenger row", () => {
    const rows = buildCollectedDataDisplayRows({
      passenger_count_actual: 2,
    });
    expect(rows.some((r) => r.label === "Number of passengers")).toBe(true);
  });
});
