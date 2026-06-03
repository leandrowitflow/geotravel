import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isPublicHttpsWebhookUrl,
  resolveInfobipInboundWebhookUrl,
} from "./infobip-inbound-webhook-url";

describe("infobip inbound webhook URL", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.INFOBIP_INBOUND_WEBHOOK_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = env;
  });

  it("rejects localhost for Infobip", () => {
    expect(
      isPublicHttpsWebhookUrl(
        "http://localhost:3000/api/webhooks/infobip/sms",
      ),
    ).toBe(false);
  });

  it("accepts production https webhook", () => {
    expect(
      isPublicHttpsWebhookUrl(
        "https://geotravel-eta.vercel.app/api/webhooks/infobip/sms",
      ),
    ).toBe(true);
  });

  it("falls back to production when NEXT_PUBLIC_APP_URL is localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(resolveInfobipInboundWebhookUrl()).toBe(
      "https://geotravel-eta.vercel.app/api/webhooks/infobip/sms",
    );
  });

  it("uses INFOBIP_INBOUND_WEBHOOK_URL when set", () => {
    process.env.INFOBIP_INBOUND_WEBHOOK_URL =
      "https://geotravel-eta.vercel.app/api/webhooks/infobip/sms";
    expect(resolveInfobipInboundWebhookUrl()).toBe(
      "https://geotravel-eta.vercel.app/api/webhooks/infobip/sms",
    );
  });
});
