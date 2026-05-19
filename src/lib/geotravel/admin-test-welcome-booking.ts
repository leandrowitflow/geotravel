import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { WHATSAPP_PILOT_PHONE_DIGITS_351913535544 } from "@/lib/geotravel/geotravel-confirmation-message";
import { normalizeGeotravelPhoneToE164 } from "@/lib/phone/normalize-geotravel-e164";

/** Default test handset for admin “Send test welcome” (E.164); same line as second pilot. */
export const DEFAULT_GEOTRAVEL_TEST_WELCOME_E164 =
  `+${WHATSAPP_PILOT_PHONE_DIGITS_351913535544}`;

/**
 * Destination for staff-only test welcome sends.
 * Override with `GEOTRAVEL_TEST_WELCOME_E164` (any format accepted by normalize).
 */
export function resolveGeotravelTestWelcomeTargetE164(): string | null {
  const raw = (
    process.env.GEOTRAVEL_TEST_WELCOME_E164 ?? DEFAULT_GEOTRAVEL_TEST_WELCOME_E164
  ).trim();
  return normalizeGeotravelPhoneToE164(raw, { defaultCountryCode: "351" });
}

/**
 * Minimal Geotravel-shaped row for staff-only test sends (bypasses pilot phone filter).
 * Fixed `booking_reference` so repeat tests upsert the same reservation/case.
 */
export function buildSyntheticTestWelcomeBooking(
  toE164: string,
): GeotravelBooking {
  const now = new Date().toISOString();
  return {
    id: 0,
    status: "CONFIRMED",
    outcome: "Active",
    plateform: "admin_test",
    booked_date: now,
    pickup_date_time: now,
    pickup_city: "Lisbon",
    pickup_country: "Portugal",
    pickup_address: "Test pickup",
    pickup_location_type: null,
    dropoff_city: "Porto",
    dropoff_country: "Portugal",
    dropoff_address: "Test dropoff",
    dropoff_location_type: null,
    nearest_airport: null,
    vehicle_type: "Standard",
    passenger_count: 1,
    distance_km: null,
    amount: null,
    invoice_country: "Portugal",
    booking_reference: "admin-wa-test",
    passenger_phone: toE164,
    passenger_name: "Test passenger",
    loyalty_name: null,
    direction: "P2P",
    trip_type: "one_way",
    is_return: 0,
    multidays: null,
    book_lead_time: null,
    pickup_dow: null,
    updated_at: now,
  };
}
