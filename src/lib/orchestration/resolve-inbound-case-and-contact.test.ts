import { describe, expect, it } from "vitest";

/** Scoring mirrors production pick (latest inbound conversation wins). */
function scoreCase(c: {
  lastMessageAt: number;
  hasInbound: boolean;
  messageCount: number;
  case_status: string;
  orchestration_state: string;
}): number {
  let score = c.lastMessageAt;
  if (c.hasInbound) score += 1e15;
  if (c.messageCount > 0) score += 1e14;
  if (c.case_status === "active") score += 1e12;
  if (c.orchestration_state !== "closed" && c.orchestration_state !== "cancelled") {
    score += 1e11;
  }
  if (
    c.orchestration_state === "collect_missing" ||
    c.orchestration_state === "identity_confirm"
  ) {
    score += 1e10;
  }
  return score;
}

describe("inbound case scoring", () => {
  it("prefers case with recent inbound over newer empty case", () => {
    const activeConversation = scoreCase({
      lastMessageAt: Date.now() - 60_000,
      hasInbound: true,
      messageCount: 5,
      case_status: "active",
      orchestration_state: "collect_missing",
    });
    const freshEmpty = scoreCase({
      lastMessageAt: Date.now(),
      hasInbound: false,
      messageCount: 0,
      case_status: "active",
      orchestration_state: "awaiting_outreach",
    });
    expect(activeConversation).toBeGreaterThan(freshEmpty);
  });
});
