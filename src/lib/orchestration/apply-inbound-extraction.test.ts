import { describe, expect, it } from "vitest";
import { inferChildrenCountWhenUnmentioned } from "./apply-inbound-extraction";

describe("inferChildrenCountWhenUnmentioned", () => {
  it("sets children_count to 0 when passengers known and message silent on children", () => {
    const merged = inferChildrenCountWhenUnmentioned(
      { passenger_count_actual: 3 },
      "3 adults, 2 cabin bags, 1 checked suitcase",
    );
    expect(merged.children_count).toBe(0);
  });

  it("does not override when message mentions children", () => {
    const merged = inferChildrenCountWhenUnmentioned(
      { passenger_count_actual: 4 },
      "2 adults and 2 children aged 5 and 8",
    );
    expect(merged.children_count).toBeUndefined();
  });
});
