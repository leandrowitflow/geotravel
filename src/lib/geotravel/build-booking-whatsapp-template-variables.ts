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
    return { first_name: firstName };
  }

  if (name === "satisfaction") {
    return undefined;
  }

  const common = {
    operator: operatorLabel(),
    plateform: templatePlateform(booking),
    booking_reference: templateBookingReference(booking),
    pickup_date_time: formatBookingPickupDateTimeForTemplate(
      booking.pickup_date_time,
    ),
  };

  if (name === "welcome_1" || name === "welcome_2" || name === "canceled") {
    return common;
  }

  if (name === "data") {
    return {
      ...common,
      pickup_city: templateCity(booking.pickup_city, booking.pickup_address),
      dropoff_city: templateCity(booking.dropoff_city, booking.dropoff_address),
    };
  }

  return { first_name: firstName };
}
