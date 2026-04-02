import { describe, expect, it } from "vitest";
import { recordConsentFromText } from "./commercial-layer";

describe("commercial-layer", () => {
  it("parses affirmative consent", () => {
    const c = recordConsentFromText("Yes please", {});
    expect(c.consent_future_marketing).toBe(true);
  });

  it("parses refusal", () => {
    const c = recordConsentFromText("No thanks", {});
    expect(c.consent_future_marketing).toBe(false);
  });
});
