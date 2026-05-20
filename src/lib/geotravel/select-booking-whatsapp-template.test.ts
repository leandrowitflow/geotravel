import { afterEach, describe, expect, it } from "vitest";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import {
  hoursUntilPickup,
  resolveMetaTemplateName,
  selectBookingWhatsappTemplate,
} from "./select-booking-whatsapp-template";

function booking(
  partial: Partial<GeotravelBooking> & { pickup_date_time?: string | null },
): GeotravelBooking {
  return {
    id: 1,
    outcome: "Active",
    status: "CONFIRMED",
    passenger_phone: "966915976",
    ...partial,
  } as GeotravelBooking;
}

const now = Date.parse("2026-05-19T12:00:00.000Z");

describe("resolveMetaTemplateName", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses the lifecycle phase name as the Meta template by default", () => {
    delete process.env.WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE;
    delete process.env.WHATSAPP_META_TEMPLATE_WELCOME_1;
    expect(resolveMetaTemplateName("welcome_1")).toBe("welcome_1");
    expect(resolveMetaTemplateName("data")).toBe("data");
  });

  it("honors WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE when set", () => {
    process.env.WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE = "booking_confirmation";
    expect(resolveMetaTemplateName("welcome_2")).toBe("booking_confirmation");
  });
});

describe("selectBookingWhatsappTemplate", () => {
  it("uses welcome_1 phase when more than 72h until pickup", () => {
    delete process.env.WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE;
    const b = booking({
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    const sel = selectBookingWhatsappTemplate(b, now);
    expect(sel.phase).toBe("welcome_1");
    expect(sel.metaTemplateName).toBe("welcome_1");
    expect(sel.language).toBe("pt_PT");
  });

  it("uses welcome_2 phase when between 48h and 72h until pickup", () => {
    delete process.env.WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE;
    const b = booking({
      pickup_date_time: "2026-05-21T14:00:00.000Z",
    });
    const sel = selectBookingWhatsappTemplate(b, now);
    expect(sel.phase).toBe("welcome_2");
    expect(sel.metaTemplateName).toBe("welcome_2");
  });

  it("uses data phase within 48h of pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-20T06:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).phase).toBe("data");
  });

  it("uses canceled phase when booking is cancelled", () => {
    const b = booking({
      outcome: "Cancelled",
      pickup_date_time: "2026-05-23T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).phase).toBe("canceled");
  });

  it("uses satisfaction phase after pickup", () => {
    const b = booking({
      pickup_date_time: "2026-05-18T12:00:00.000Z",
    });
    expect(selectBookingWhatsappTemplate(b, now).phase).toBe("satisfaction");
  });
});

describe("hoursUntilPickup", () => {
  it("returns negative after pickup", () => {
    const h = hoursUntilPickup(
      booking({ pickup_date_time: "2026-05-18T12:00:00.000Z" }),
      now,
    );
    expect(h).not.toBeNull();
    expect(h!).toBeLessThan(0);
  });
});
