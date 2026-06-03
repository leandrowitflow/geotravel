import { describe, expect, it } from "vitest";
import {
  estimateSmsSegments,
  smsUsesUcs2Encoding,
} from "./estimate-sms-segments";

describe("estimateSmsSegments", () => {
  it("uses API message count when provided", () => {
    expect(estimateSmsSegments("hello", 2)).toBe(2);
  });

  it("counts one GSM segment for short ASCII", () => {
    expect(estimateSmsSegments("Booking confirmed")).toBe(1);
  });

  it("uses UCS-2 segments for Portuguese accents", () => {
    expect(smsUsesUcs2Encoding("Reserva confirmção")).toBe(true);
    const body = "á".repeat(71);
    expect(estimateSmsSegments(body)).toBe(2);
  });
});
