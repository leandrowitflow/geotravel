/**
 * Inserts demo reservation + case via the same path as POST /api/ingest/reservation.
 * Run from repo root: npm run db:seed
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { ingestReservationEvent } = await import(
    "../src/lib/services/ingest-reservation"
  );

  const suffix = Date.now();
  const result = await ingestReservationEvent({
    type: "create",
    idempotency_key: `seed_demo_${suffix}`,
    reservation: {
      external_source: "demo",
      external_booking_id: `DEMO-${suffix}`,
      pickup_datetime: new Date(Date.now() + 86400_000).toISOString(),
      pickup_location: "Barcelona Airport (BCN)",
      dropoff_location: "Hotel Example, Carrer de la Demo 1",
      booking_status: "active",
      source_phone: "+34600111222",
      customer_name: "Demo Passenger",
      source_language_hint: "en",
    },
  });

  if (!result.ok) {
    console.error("Seed failed:", result.error);
    process.exit(1);
  }

  console.log(
    "Demo data created. Open /admin/cases — reservation_id:",
    result.reservationId,
    "case_id:",
    result.caseId ?? "(n/a)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
