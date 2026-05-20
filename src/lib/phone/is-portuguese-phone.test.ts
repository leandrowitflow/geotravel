import { describe, expect, it } from "vitest";
import {
  isPortuguesePhoneE164,
  isPortuguesePhoneRaw,
  isPortugueseRecipientPhone,
} from "./is-portuguese-phone";

describe("isPortuguesePhoneE164", () => {
  it("accepts +351", () => {
    expect(isPortuguesePhoneE164("+351966915976")).toBe(true);
  });

  it("rejects non-PT", () => {
    expect(isPortuguesePhoneE164("+14155550123")).toBe(false);
  });
});

describe("isPortuguesePhoneRaw", () => {
  it("accepts national 9-digit PT", () => {
    expect(isPortuguesePhoneRaw("966915976")).toBe(true);
    expect(isPortuguesePhoneRaw("930478387")).toBe(true);
  });

  it("accepts international digits", () => {
    expect(isPortuguesePhoneRaw("351966915976")).toBe(true);
  });
});

describe("isPortugueseRecipientPhone", () => {
  it("prefers normalized E.164", () => {
    expect(isPortugueseRecipientPhone("966915976", "+351966915976")).toBe(true);
    expect(isPortugueseRecipientPhone("966915976", "+14155550123")).toBe(true);
  });
});
