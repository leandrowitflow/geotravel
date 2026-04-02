/** Behavioural event types — geotravel_spec_kit 03_specify_data_and_behaviour */

export const BEHAVIOURAL_EVENT_TYPES = [
  "case_created",
  "reservation_synced",
  "outbound_message_sent",
  "outbound_message_delivered",
  "outbound_message_read",
  "customer_replied",
  "language_detected",
  "field_requested",
  "field_completed",
  "field_refused",
  "extraction_low_confidence",
  "crm_write_attempted",
  "crm_write_succeeded",
  "crm_write_failed",
  "fallback_sms_triggered",
  "d1_confirmation_requested",
  "d1_confirmed",
  "d1_not_confirmed",
  "consent_requested",
  "consent_granted",
  "consent_declined",
  "offer_eligibility_detected",
  "offer_shown",
  "offer_clicked",
  "offer_accepted",
  "opt_out_requested",
  "human_intervention_requested",
  "case_closed",
] as const;

export type BehaviouralEventType = (typeof BEHAVIOURAL_EVENT_TYPES)[number];

export type BehaviouralEventPayload = {
  event_id?: string;
  case_id?: string;
  reservation_id?: string;
  channel?: string;
  language?: string;
  metadata?: Record<string, unknown>;
};
