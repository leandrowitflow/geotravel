import { z } from "zod";

/** MVP priority languages — geotravel_spec_kit 02 */
export const SUPPORTED_LANGUAGES = [
  "en",
  "pt",
  "es",
  "fr",
  "de",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_CONFIDENCE_THRESHOLD = 0.72;

/** Structured enrichment fields with per-field confidence 0–1 */
export const extractionResultSchema = z.object({
  passenger_count_actual: z.number().int().positive().nullable().optional(),
  children_count: z.number().int().min(0).nullable().optional(),
  child_ages: z.array(z.number().int().min(0).max(17)).nullable().optional(),
  special_luggage_present: z.boolean().nullable().optional(),
  special_luggage_types: z.array(z.string()).nullable().optional(),
  reduced_mobility_present: z.boolean().nullable().optional(),
  reduced_mobility_notes: z.string().nullable().optional(),
  baby_stroller_present: z.boolean().nullable().optional(),
  child_seat_needed: z.boolean().nullable().optional(),
  additional_notes: z.string().nullable().optional(),
  confidence: z.record(z.string(), z.number().min(0).max(1)).optional(),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const CRITICAL_FIELD_KEYS = [
  "passenger_count_actual",
  "children_count",
  "child_ages",
  "special_luggage_present",
  "special_luggage_types",
  "reduced_mobility_present",
  "reduced_mobility_notes",
  "baby_stroller_present",
  "child_seat_needed",
  "additional_notes",
] as const;
