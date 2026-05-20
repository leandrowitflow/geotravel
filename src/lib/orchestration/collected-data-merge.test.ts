import { describe, expect, it } from "vitest";
import { mergeCollectedData } from "./collected-data-merge";

describe("mergeCollectedData", () => {
  it("merges passenger and luggage from message extraction", () => {
    const merged = mergeCollectedData(
      {},
      {
        passenger_count_actual: 3,
        cabin_luggage_pieces: 2,
        checked_luggage_pieces: 1,
        extras_items: ["golf_bag"],
        confidence: { passenger_count_actual: 0.9 },
      },
    );
    expect(merged.passenger_count_actual).toBe(3);
    expect(merged.cabin_luggage_pieces).toBe(2);
    expect(merged.checked_luggage_pieces).toBe(1);
    expect(merged.extras_items).toEqual(["golf_bag"]);
    expect(merged.special_luggage_present).toBe(true);
  });

  it("unions extras across messages", () => {
    const merged = mergeCollectedData(
      { extras_items: ["golf_bag"] },
      { extras_items: ["wheelchair"] },
    );
    expect(merged.extras_items).toEqual(
      expect.arrayContaining(["golf_bag", "wheelchair"]),
    );
  });

  it("records no extras when confirmed", () => {
    const merged = mergeCollectedData({}, { extras_none_confirmed: true });
    expect(merged.extras_none_confirmed).toBe(true);
    expect(merged.extras_items).toEqual([]);
    expect(merged.special_luggage_present).toBe(false);
  });
});
