import { z } from "zod";
import { EXTRA_ITEM_VALUES } from "@/lib/contracts/extras-items";

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

/**
 * OpenAI GPT-5.x structured output: every property must be required; use null when unknown.
 * (No .optional() — avoids invalid_json_schema on the Responses API.)
 */
export const extractionFieldsSchema = z.object({
  passenger_count_actual: z.number().int().positive().nullable(),
  children_count: z.number().int().min(0).nullable(),
  child_ages: z.array(z.number().int().min(0).max(17)).nullable(),
  cabin_luggage_pieces: z.number().int().min(0).nullable(),
  cabin_luggage_notes: z.string().nullable(),
  checked_luggage_pieces: z.number().int().min(0).nullable(),
  checked_luggage_notes: z.string().nullable(),
  extras_items: z.array(z.enum(EXTRA_ITEM_VALUES)).nullable(),
  extras_none_confirmed: z.boolean().nullable(),
  extras_notes: z.string().nullable(),
  special_luggage_present: z.boolean().nullable(),
  special_luggage_types: z.array(z.string()).nullable(),
  reduced_mobility_present: z.boolean().nullable(),
  reduced_mobility_notes: z.string().nullable(),
  baby_stroller_present: z.boolean().nullable(),
  child_seat_needed: z.boolean().nullable(),
  additional_notes: z.string().nullable(),
});

export type ExtractionFields = z.infer<typeof extractionFieldsSchema>;

/** After extraction — includes per-field confidence for case storage. */
export type ExtractionResult = ExtractionFields & {
  confidence?: Record<string, number>;
};

/** @deprecated Use extractionFieldsSchema for generateObject; kept for imports. */
export const extractionResultSchema = extractionFieldsSchema;

export const CRITICAL_FIELD_KEYS = [
  "passenger_count_actual",
  "children_count",
  "child_ages",
  "cabin_luggage_pieces",
  "checked_luggage_pieces",
  "extras_items",
  "extras_none_confirmed",
  "reduced_mobility_present",
  "additional_notes",
] as const;
