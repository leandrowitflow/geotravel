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
  it("allows enrichment only for data and booking_confirmation", () => {
    expect(allowsOperationalEnrichmentForPhase("data")).toBe(true);
    expect(allowsOperationalEnrichmentForPhase("booking_confirmation")).toBe(
      true,
    );
    expect(allowsOperationalEnrichmentForPhase("welcome_1")).toBe(false);
    expect(allowsOperationalEnrichmentForPhase("welcome_2")).toBe(false);
    expect(allowsOperationalEnrichmentForPhase("canceled")).toBe(false);
    expect(allowsOperationalEnrichmentForPhase("satisfaction")).toBe(false);
  });
});

describe("buildWhatsappTemplateConversationContext", () => {
  it("welcome phases focus on greeting not operational data", () => {
    const w1 = buildWhatsappTemplateConversationContext({ phase: "welcome_1" });
    expect(w1.aiInstructions).toMatch(/GREETING/i);
    expect(w1.aiInstructions).toMatch(/Ask for passenger counts/i);
    const w2 = buildWhatsappTemplateConversationContext({ phase: "welcome_2" });
    expect(w2.aiInstructions).toMatch(/GREETING/i);
  });

  it("data phase focuses on collecting missing details", () => {
    const ctx = buildWhatsappTemplateConversationContext({ phase: "data" });
    expect(ctx.allowsOperationalEnrichment).toBe(true);
    expect(ctx.aiInstructions).toMatch(/COLLECT MISSING/i);
  });

  it("canceled phase focuses on understanding why", () => {
    const ctx = buildWhatsappTemplateConversationContext({ phase: "canceled" });
    expect(ctx.allowsOperationalEnrichment).toBe(false);
    expect(ctx.aiInstructions).toMatch(/WHY IT WAS CANCELLED/i);
  });

  it("satisfaction phase focuses on travel feedback", () => {
    const ctx = buildWhatsappTemplateConversationContext({
      phase: "satisfaction",
    });
    expect(ctx.aiInstructions).toMatch(/FEEDBACK/i);
  });
});
