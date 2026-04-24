import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";

/**
 * Builds JSON for POST/PUT v2/saveBooking.
 * Exact schema is tenant-specific — confirm in Swagger "Try it out":
 * https://webhook.backoffice.tg4travel.com/index.html#/
 *
 * We send identifiers plus a single configurable text field for enrichment/confirmation
 * so operators can map TG4TRAVEL_NOTES_FIELD to the real property name via env.
 */

export function formatEnrichmentNotes(p: CrmEnrichmentWrite): string {
  const lines: string[] = ["[Geotravel agent — enrichment]"];
  if (p.passenger_count_actual != null) {
    lines.push(`Passengers: ${p.passenger_count_actual}`);
  }
  if (p.children_count != null) {
    lines.push(`Children: ${p.children_count}`);
  }
  if (p.child_ages?.length) {
    lines.push(`Child ages: ${p.child_ages.join(", ")}`);
  }
  if (p.special_luggage_present != null) {
    lines.push(`Special luggage: ${p.special_luggage_present}`);
  }
  if (p.special_luggage_types?.length) {
    lines.push(`Luggage types: ${p.special_luggage_types.join(", ")}`);
  }
  if (p.reduced_mobility_present != null) {
    lines.push(`Reduced mobility: ${p.reduced_mobility_present}`);
  }
  if (p.reduced_mobility_notes) {
    lines.push(`Mobility notes: ${p.reduced_mobility_notes}`);
  }
  if (p.baby_stroller_present != null) {
    lines.push(`Baby stroller: ${p.baby_stroller_present}`);
  }
  if (p.child_seat_needed != null) {
    lines.push(`Child seat needed: ${p.child_seat_needed}`);
  }
  if (p.additional_notes) {
    lines.push(`Notes: ${p.additional_notes}`);
  }
  if (p.last_confirmed_at) {
    lines.push(`Confirmed at: ${p.last_confirmed_at}`);
  }
  return lines.join("\n");
}

export function formatConfirmationNotes(p: CrmConfirmationWrite): string {
  return [
    "[Geotravel agent — D-1 confirmation]",
    `Confirmed: ${p.d1_confirmed}`,
    `Recorded at: ${p.d1_recorded_at}`,
  ].join("\n");
}

export function buildSaveBookingBodyFromEnrichment(
  p: CrmEnrichmentWrite,
): Record<string, unknown> {
  return buildSaveBookingBodyCore(p.external_booking_id, p.external_source, {
    enrichment: formatEnrichmentNotes(p),
  });
}

export function buildSaveBookingBodyFromConfirmation(
  p: CrmConfirmationWrite,
): Record<string, unknown> {
  return buildSaveBookingBodyCore(p.external_booking_id, p.external_source, {
    confirmation: formatConfirmationNotes(p),
  });
}

function buildSaveBookingBodyCore(
  bookingReference: string,
  platform: string,
  parts: { enrichment?: string; confirmation?: string },
): Record<string, unknown> {
  const notesField =
    process.env.TG4TRAVEL_NOTES_FIELD?.trim() || "specialInstructions";
  const text = [parts.enrichment, parts.confirmation].filter(Boolean).join("\n\n");

  const body: Record<string, unknown> = {
    bookingReference,
    platform,
    [notesField]: text,
  };

  const customerRef = process.env.TG4TRAVEL_CUSTOMER_REFERENCE?.trim();
  if (customerRef) {
    body.customerReference = customerRef;
  }

  const extraJson = process.env.TG4TRAVEL_SAVE_BOOKING_EXTRA_JSON?.trim();
  if (extraJson) {
    try {
      const extra = JSON.parse(extraJson) as Record<string, unknown>;
      Object.assign(body, extra);
    } catch {
      /* ignore invalid JSON */
    }
  }

  return body;
}
