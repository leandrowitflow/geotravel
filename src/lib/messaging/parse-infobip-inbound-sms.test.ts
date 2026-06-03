import { describe, expect, it } from "vitest";
import { parseInfobipInboundSmsPayload } from "./parse-infobip-inbound-sms";

describe("parseInfobipInboundSmsPayload", () => {
  it("parses MO_JSON_2 results array", () => {
    const msgs = parseInfobipInboundSmsPayload({
      results: [
        {
          from: "351966915976",
          to: "351923250271",
          cleanText: "Somos 4 pessoas",
          messageId: "abc-123",
        },
      ],
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.fromE164).toBe("+351966915976");
    expect(msgs[0]?.body).toBe("Somos 4 pessoas");
  });

  it("parses CPaaS-style sender + message.text", () => {
    const msgs = parseInfobipInboundSmsPayload({
      results: [
        {
          sender: "351966915976",
          to: "351923250271",
          messageId: "x1",
          message: { type: "text", text: "Hello" },
        },
      ],
    });
    expect(msgs[0]?.body).toBe("Hello");
    expect(msgs[0]?.fromE164).toBe("+351966915976");
  });

  it("uses text when cleanText empty", () => {
    const msgs = parseInfobipInboundSmsPayload({
      results: [{ from: "351966915976", text: "Oi", messageId: "1" }],
    });
    expect(msgs[0]?.body).toBe("Oi");
  });
});
