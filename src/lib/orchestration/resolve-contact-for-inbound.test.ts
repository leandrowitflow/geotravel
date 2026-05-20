import { describe, expect, it } from "vitest";
import {
  canonicalInboundPhoneCandidates,
  canonicalizeInboundWebhookFrom,
  digitsOnlyPhone,
  normalizeMessagingE164,
  primaryCanonicalInboundPhone,
} from "./resolve-contact-for-inbound";

describe("normalizeMessagingE164", () => {
  it("adds + and strips separators", () => {
    expect(normalizeMessagingE164("+351 966 915 976")).toBe("+351966915976");
    expect(normalizeMessagingE164("351966915976")).toBe("+351966915976");
  });
});

describe("digitsOnlyPhone", () => {
  it("strips non-digits", () => {
    expect(digitsOnlyPhone("+351-966-915-976")).toBe("351966915976");
  });
});

describe("canonicalizeInboundWebhookFrom", () => {
  it("maps Meta from field to +351 for PT national", () => {
    expect(canonicalizeInboundWebhookFrom("966915976")).toBe("+351966915976");
    expect(canonicalizeInboundWebhookFrom("351966915976")).toBe("+351966915976");
  });
});

describe("canonicalInboundPhoneCandidates (PT default)", () => {
  it("maps national PT mobile to +351… for lookup keys", () => {
    const keys = canonicalInboundPhoneCandidates("966915976");
    expect(keys).toContain("+351966915976");
    expect(primaryCanonicalInboundPhone("966915976")).toBe("+351966915976");
  });

  it("does not add Saudi +966… for PT national mobiles", () => {
    const keys = canonicalInboundPhoneCandidates("966915976");
    expect(keys).toContain("+351966915976");
    expect(keys).not.toContain("+966915976");
  });

  it("includes explicit +351 form", () => {
    const keys = canonicalInboundPhoneCandidates("+351966915976");
    expect(keys).toContain("+351966915976");
  });
});
