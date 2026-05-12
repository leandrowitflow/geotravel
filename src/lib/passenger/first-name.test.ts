import { describe, expect, it } from "vitest";
import { firstNameFromDisplayName } from "./first-name";

describe("firstNameFromDisplayName", () => {
  it("returns first token", () => {
    expect(firstNameFromDisplayName("Maria Silva")).toBe("Maria");
  });

  it("handles null", () => {
    expect(firstNameFromDisplayName(null)).toBeNull();
  });
});
