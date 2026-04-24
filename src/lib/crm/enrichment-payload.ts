import type { CollectedDataJson, ReservationRow } from "@/db/schema";

export function buildCrmEnrichmentPayload(
  reservation: ReservationRow,
  data: CollectedDataJson,
) {
  return {
    external_source: reservation.externalSource,
    external_booking_id: reservation.externalBookingId,
    passenger_count_actual: data.passenger_count_actual ?? undefined,
    children_count: data.children_count ?? undefined,
    child_ages: data.child_ages ?? undefined,
    special_luggage_present: data.special_luggage_present ?? undefined,
    special_luggage_types: data.special_luggage_types ?? undefined,
    reduced_mobility_present: data.reduced_mobility_present ?? undefined,
    reduced_mobility_notes: data.reduced_mobility_notes ?? undefined,
    baby_stroller_present: data.baby_stroller_present ?? undefined,
    child_seat_needed: data.child_seat_needed ?? undefined,
    additional_notes: data.additional_notes ?? undefined,
    collection_confidence: data.collection_confidence,
    last_confirmed_at: new Date().toISOString(),
  };
}
