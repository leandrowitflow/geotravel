import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";

const DEFAULT_OPERATOR = "Geotravel";

/** Meta template body uses `{{plateform}}` (Geotravel API spelling). */
function templatePlateform(booking: GeotravelBooking): string {
  const p = booking.plateform?.trim();
  return p || "—";
}

function templateBookingReference(booking: GeotravelBooking): string {
  return booking.booking_reference?.trim() || String(booking.id);
}

/** Human-readable pickup time for template body (Meta max ~1024 chars per param; keep concise). */
export function formatBookingPickupDateTimeForTemplate(
  iso: string | null | undefined,
): string {
  const raw = iso?.trim();
  if (!raw) return "—";
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw.slice(0, 80);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function templateCity(
  city: string | null | undefined,
  address: string | null | undefined,
): string {
  const parts = [city?.trim(), address?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function operatorLabel(): string {
  return process.env.GEOTRAVEL_WHATSAPP_OPERATOR?.trim() || DEFAULT_OPERATOR;
}

/**
 * Body variables for Meta WhatsApp templates on the Geotravel WABA.
 * Must match placeholders from `npm run whatsapp:template-params`.
 */
export function buildBookingWhatsappTemplateVariables(
  booking: GeotravelBooking,
  templateName: string,
  firstName: string,
): Record<string, string> | undefined {
  const name = templateName.trim();

  if (name === "booking_confirmation" || name === "booking_confirm") {
    return { first_name: firstName, operator: operatorLabel() };
  }

  if (name === "satisfaction") {
    return { operator: operatorLabel() };
  }

  const operator = operatorLabel();
  const plateform = templatePlateform(booking);
  const booking_reference = templateBookingReference(booking);
  const pickup_date_time = formatBookingPickupDateTimeForTemplate(
    booking.pickup_date_time,
  );

  /** welcome_1 / welcome_2 / canceled — run `npm run whatsapp:template-params` */
  if (name === "welcome_1" || name === "welcome_2" || name === "canceled") {
    return {
      operator,
      plateform,
      booking_reference,
      pickup_date_time,
    };
  }

  /**
   * data — Meta body uses cities + datetime only (no booking_reference on WABA).
   * named vars: operator, plateform, pickup_city, dropoff_city, pickup_date_time
   */
  if (name === "data") {
    return {
      operator,
      plateform,
      pickup_city: templateCity(booking.pickup_city, booking.pickup_address),
      dropoff_city: templateCity(booking.dropoff_city, booking.dropoff_address),
      pickup_date_time,
    };
  }

  return { first_name: firstName };
}
