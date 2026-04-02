import type { InferSelectModel } from "drizzle-orm";
import {
  reservations,
  type CollectedDataJson,
  type ConsentJson,
  type OfferSignalJson,
} from "@/db/schema";

type ReservationRow = InferSelectModel<typeof reservations>;

export function computeOfferEligibility(
  _reservation: ReservationRow,
  _collected: CollectedDataJson | null | undefined,
): OfferSignalJson {
  void _reservation;
  void _collected;
  return {
    return_transfer_missing: true,
    return_transfer_eligible: true,
    upgrade_eligible: false,
    partner_offer_eligible: false,
    offer_reason_codes: ["post_operational_complete"],
    offer_shown: false,
    offer_accepted: false,
  };
}

export function recordConsentFromText(
  text: string,
  prior: ConsentJson | null | undefined,
): ConsentJson {
  const lower = text.toLowerCase();
  const yes = /\byes\b|sim|sí|oui|ja\b/i.test(lower);
  const no = /\bno\b|não|non|nein/i.test(lower);
  return {
    ...prior,
    consent_operational_basis: prior?.consent_operational_basis ?? true,
    consent_future_marketing: yes && !no,
    consent_captured_at: new Date().toISOString(),
    consent_source: "messaging_reply",
  };
}
