import { describe, expect, it } from "vitest";
import { extractOperationalFieldsHeuristic } from "./operational-extraction-heuristic";
import { mergeCollectedData } from "@/lib/orchestration/collected-data-merge";
import { inferChildrenCountWhenUnmentioned } from "@/lib/orchestration/apply-inbound-extraction";

describe("extractOperationalFieldsHeuristic", () => {
  it("parses PT message with passengers, malas, and baby seat", () => {
    const msg =
      "Somos 4 pessoas, com 5 malas e precisamos de cadeira de bebé";
    const h = extractOperationalFieldsHeuristic(msg);
    expect(h.passenger_count_actual).toBe(4);
    expect(h.checked_luggage_pieces).toBe(5);
    expect(h.extras_items).toContain("baby_seat");
  });

  it("splits cabin vs checked when specified", () => {
    const h = extractOperationalFieldsHeuristic(
      "2 pessoas, 1 mala de mão e 3 malas de porão",
    );
    expect(h.passenger_count_actual).toBe(2);
    expect(h.cabin_luggage_pieces).toBe(1);
    expect(h.checked_luggage_pieces).toBe(3);
  });

  it("infers zero children when passengers set and no child mention", () => {
    const msg = "Somos 4 pessoas, com 5 malas";
    let merged = mergeCollectedData({}, extractOperationalFieldsHeuristic(msg));
    merged = inferChildrenCountWhenUnmentioned(merged, msg);
    expect(merged.children_count).toBe(0);
  });
});
