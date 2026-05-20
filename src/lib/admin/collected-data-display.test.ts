import { describe, expect, it } from "vitest";
import { buildCollectedDataDisplayRows } from "./collected-data-display";

describe("buildCollectedDataDisplayRows", () => {
  it("shows passenger, luggage, and extras in admin labels", () => {
    const rows = buildCollectedDataDisplayRows({
      passenger_count_actual: 2,
      cabin_luggage_pieces: 1,
      checked_luggage_pieces: 2,
      extras_items: ["baby_seat", "golf_bag"],
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Number of passengers");
    expect(labels).toContain("Cabin luggage");
    expect(labels).toContain("Checked luggage");
    expect(labels).toContain("Any extras?");
    expect(rows.find((r) => r.label === "Any extras?")?.value).toMatch(
      /Baby seat/,
    );
  });
});
