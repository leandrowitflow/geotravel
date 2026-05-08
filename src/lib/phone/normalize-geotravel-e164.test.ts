import { describe, expect, it } from "vitest";
import { normalizeGeotravelPhoneToE164 } from "./normalize-geotravel-e164";

describe("normalizeGeotravelPhoneToE164", () => {
  it("prefixes PT country code for 9-digit national (avoids +966 Saudi)", () => {
    expect(normalizeGeotravelPhoneToE164("966915976")).toBe("+351966915976");
  });

  it("keeps full international PT", () => {
    expect(normalizeGeotravelPhoneToE164("+351 966 915 976")).toBe(
      "+351966915976",
    );
    expect(normalizeGeotravelPhoneToE164("351966915976")).toBe("+351966915976");
  });

  it("strips 00 prefix", () => {
    expect(normalizeGeotravelPhoneToE164("00351966915976")).toBe(
      "+351966915976",
    );
  });
});
