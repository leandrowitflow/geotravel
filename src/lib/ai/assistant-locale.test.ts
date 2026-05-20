import { describe, expect, it } from "vitest";
import { assistantFallbackFromPhone, toAssistantLocale } from "./assistant-locale";

describe("toAssistantLocale", () => {
  it("maps non-pt languages to en", () => {
    expect(toAssistantLocale("es")).toBe("en");
    expect(toAssistantLocale("pt")).toBe("pt");
  });
});

describe("assistantFallbackFromPhone", () => {
  it("prefers pt for Portuguese numbers", () => {
    expect(assistantFallbackFromPhone("+351966915976")).toBe("pt");
    expect(assistantFallbackFromPhone("+441234567890")).toBe("en");
  });
});
