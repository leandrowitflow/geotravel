import { describe, expect, it } from "vitest";
import { formatEnrichmentNotes, formatConfirmationNotes } from "./map-save-booking-body";

describe("tg4travel map-save-booking-body", () => {
  it("formats enrichment notes", () => {
    const s = formatEnrichmentNotes({
      external_source: "booking.com",
      external_booking_id: "abc",
      passenger_count_actual: 3,
      children_count: 1,
    });
    expect(s).toContain("Passengers: 3");
    expect(s).toContain("Children: 1");
    expect(s).toContain("[Geotravel agent — enrichment]");
  });

  it("formats confirmation notes", () => {
    const s = formatConfirmationNotes({
      external_source: "x",
      external_booking_id: "y",
      d1_confirmed: true,
      d1_recorded_at: "2026-04-02T12:00:00.000Z",
    });
    expect(s).toContain("D-1 confirmation");
    expect(s).toContain("true");
  });
});
