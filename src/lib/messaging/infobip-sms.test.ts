import { describe, expect, it } from "vitest";
import { formatSmsOutboundText } from "./infobip-sms";

describe("formatSmsOutboundText", () => {
  it("collapses newlines to single spaces", () => {
    expect(formatSmsOutboundText("Caro(a) Cliente,\n\nSomos a Geotravel.")).toBe(
      "Caro(a) Cliente, Somos a Geotravel.",
    );
  });
});
