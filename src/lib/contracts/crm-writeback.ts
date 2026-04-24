import { z } from "zod";

/** Internal CRM write-back payloads (mapped to stub / future real CRM) */

export const crmEnrichmentWriteSchema = z.object({
  external_source: z.string(),
  external_booking_id: z.string(),
  passenger_count_actual: z.number().int().optional(),
  children_count: z.number().int().optional(),
  child_ages: z.array(z.number()).optional(),
  special_luggage_present: z.boolean().optional(),
  special_luggage_types: z.array(z.string()).optional(),
  reduced_mobility_present: z.boolean().optional(),
  reduced_mobility_notes: z.string().optional(),
  baby_stroller_present: z.boolean().optional(),
  child_seat_needed: z.boolean().optional(),
  additional_notes: z.string().optional(),
  collection_confidence: z.record(z.string(), z.number()).optional(),
  last_confirmed_at: z.string().datetime({ offset: true }).optional(),
});

export type CrmEnrichmentWrite = z.infer<typeof crmEnrichmentWriteSchema>;

export const crmConfirmationWriteSchema = z.object({
  external_source: z.string(),
  external_booking_id: z.string(),
  d1_confirmed: z.boolean(),
  d1_recorded_at: z.string().datetime({ offset: true }),
});

export type CrmConfirmationWrite = z.infer<typeof crmConfirmationWriteSchema>;
