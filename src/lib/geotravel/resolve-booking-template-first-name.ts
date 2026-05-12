import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeotravelBooking } from "@/lib/geotravel/bookings-api";
import { firstNameForBookingWelcomeTemplate } from "@/lib/geotravel/geotravel-confirmation-message";

/**
 * Value for Meta template body variable `first_name`: Geotravel row first, then
 * `reservations.customer_name` after sync (covers thin/missing client payloads).
 */
export async function resolveBookingTemplateFirstName(
  sb: SupabaseClient,
  reservationPk: string,
  booking: GeotravelBooking,
): Promise<string> {
  const fromBooking =
    booking.passenger_name?.trim() || booking.loyalty_name?.trim() || null;
  if (fromBooking) {
    return firstNameForBookingWelcomeTemplate(fromBooking);
  }

  const { data, error } = await sb
    .from("reservations")
    .select("customer_name")
    .eq("id", reservationPk)
    .maybeSingle();

  if (error) {
    return firstNameForBookingWelcomeTemplate(null);
  }

  return firstNameForBookingWelcomeTemplate(data?.customer_name);
}
