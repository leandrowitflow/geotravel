import { describe, expect, it } from "vitest";
import {
  buildBookingWelcomeTemplateBody,
  firstNameForBookingWelcomeTemplate,
} from "./geotravel-confirmation-message";

describe("firstNameForBookingWelcomeTemplate", () => {
  it("uses first token", () => {
    expect(firstNameForBookingWelcomeTemplate("Maria Silva")).toBe("Maria");
  });

  it("falls back to there", () => {
    expect(firstNameForBookingWelcomeTemplate(null)).toBe("there");
    expect(firstNameForBookingWelcomeTemplate("   ")).toBe("there");
  });
});

describe("buildBookingWelcomeTemplateBody", () => {
  it("matches welcome copy", () => {
    expect(buildBookingWelcomeTemplateBody("Maria")).toBe(
      "Hello Maria, welcome to Geotravel. Thank you for reaching out. We're here to help with your transfer. If you have any questions, just reply to this message.",
    );
  });
});
