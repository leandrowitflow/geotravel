import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  isTerminalState,
} from "./state-machine";

describe("state-machine", () => {
  it("allows identity to collect_missing", () => {
    expect(canTransition("identity_confirm", "collect_missing")).toBe(true);
  });

  it("rejects commercial before operational path", () => {
    expect(canTransition("collect_missing", "commercial_eligible")).toBe(false);
  });

  it("marks terminal states", () => {
    expect(isTerminalState("closed")).toBe(true);
    expect(isTerminalState("collect_missing")).toBe(false);
  });

  it("assertTransition throws on invalid", () => {
    expect(() =>
      assertTransition("commercial_eligible", "collect_missing"),
    ).toThrow();
  });
});
