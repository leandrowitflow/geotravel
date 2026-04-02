import { z } from "zod";

/** Inbound reservation event contract — create / update / cancel */

export const reservationIngestEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create"),
    idempotency_key: z.string().min(1),
    reservation: z.object({
      external_source: z.string(),
      external_booking_id: z.string(),
      pickup_datetime: z.string().datetime({ offset: true }).optional(),
      pickup_location: z.string().optional(),
      dropoff_location: z.string().optional(),
      booking_status: z.enum(["active", "cancelled", "completed"]).default("active"),
      source_phone: z.string().optional(),
      source_email: z.string().optional(),
      source_language_hint: z.string().optional(),
      customer_name: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("update"),
    idempotency_key: z.string().min(1),
    external_source: z.string(),
    external_booking_id: z.string(),
    changes: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("cancel"),
    idempotency_key: z.string().min(1),
    external_source: z.string(),
    external_booking_id: z.string(),
    reason: z.string().optional(),
  }),
]);

export type ReservationIngestEvent = z.infer<typeof reservationIngestEventSchema>;
