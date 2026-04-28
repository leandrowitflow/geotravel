/**
 * Seeds the Geotravel-style mock reservation (+351966915976) as a real DB case
 * for WhatsApp testing (same ref as GEOTRAVEL_MOCK_BOOKINGS row on /admin/bookings).
 *
 * Run: npm run db:seed
 *
 * Re-runs: same external_source + external_booking_id returns the existing
 * reservation (no duplicate case). To recreate from scratch, delete that row
 * in `reservations` (and related contacts/cases) or bump idempotency_key below.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { ingestReservationEvent } = await import(
    "../src/lib/services/ingest-reservation"
  );

  const result = await ingestReservationEvent({
    type: "create",
    idempotency_key: "seed_geotravel_mock_351_wpp_v1",
    reservation: {
      external_source: "geotravel_mock",
      external_booking_id: "MOCK-351966915976-NEW",
      pickup_datetime: new Date(Date.now() + 2 * 86400_000).toISOString(),
      pickup_location: "Lisbon Airport (LIS)",
      dropoff_location: "Cascais — Hotel mock bay",
      booking_status: "active",
      source_phone: "+351966915976",
      customer_name: "Mock Cliente (NEW)",
      source_language_hint: "pt",
    },
  });

  if (!result.ok) {
    console.error("Seed failed:", result.error);
    process.exit(1);
  }

  console.log(
    "WhatsApp test case ready. Inbound messages from +351966915976 will match this contact.",
  );
  console.log("  /admin/cases — reservation_id:", result.reservationId, "case_id:", result.caseId ?? "(existing dup)");
  console.log("  /admin/bookings — enable GEOTRAVEL_MOCK_BOOKINGS=1 to see the same ref in the Geotravel table.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
