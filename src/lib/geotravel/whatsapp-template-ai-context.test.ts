import { describe, expect, it } from "vitest";
import {
  allowsOperationalEnrichmentForPhase,
  buildWhatsappTemplateConversationContext,
  parseStoredOutboundTemplatePhase,
  resolvePhaseFromMetaTemplateName,
} from "./whatsapp-template-ai-context";

describe("resolvePhaseFromMetaTemplateName", () => {
  it("maps lifecycle names", () => {
    expect(resolvePhaseFromMetaTemplateName("canceled")).toBe("canceled");
    expect(resolvePhaseFromMetaTemplateName("welcome_1")).toBe("welcome_1");
  });

  it("maps booking_confirmation", () => {
    expect(resolvePhaseFromMetaTemplateName("booking_confirmation")).toBe(
      "booking_confirmation",
    );
  });
});

describe("parseStoredOutboundTemplatePhase", () => {
  it("reads phase from stored outbound body", () => {
    expect(
      parseStoredOutboundTemplatePhase(
        "[WhatsApp template: canceled]\noperator: Geotravel",
      ),
    ).toBe("canceled");
  });
});

describe("allowsOperationalEnrichmentForPhase", () => {
  it("disallows enrichment for cancel and satisfaction", () => {
    expect(allowsOperationalEnrichmentForPhase("canceled")).toBe(false);
    expect(allowsOperationalEnrichmentForPhase("satisfaction")).toBe(false);
    expect(allowsOperationalEnrichmentForPhase("welcome_1")).toBe(true);
    expect(allowsOperationalEnrichmentForPhase("data")).toBe(true);
  });
});

describe("buildWhatsappTemplateConversationContext", () => {
  it("includes cancel-specific instructions", () => {
    const ctx = buildWhatsappTemplateConversationContext({ phase: "canceled" });
    expect(ctx.allowsOperationalEnrichment).toBe(false);
    expect(ctx.aiInstructions).toMatch(/cancelled/i);
    expect(ctx.aiInstructions).toMatch(/Do NOT ask.*passenger counts/i);
  });
});
