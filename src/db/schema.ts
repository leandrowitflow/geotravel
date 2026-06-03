/** JSON columns — same shapes as before (Drizzle removed). */

export type CollectedDataJson = {
  passenger_count_actual?: number | null;
  children_count?: number | null;
  child_ages?: number[] | null;
  cabin_luggage_pieces?: number | null;
  cabin_luggage_notes?: string | null;
  checked_luggage_pieces?: number | null;
  checked_luggage_notes?: string | null;
  extras_items?: string[] | null;
  extras_none_confirmed?: boolean | null;
  extras_notes?: string | null;
  special_luggage_present?: boolean | null;
  special_luggage_types?: string[] | null;
  reduced_mobility_present?: boolean | null;
  reduced_mobility_notes?: string | null;
  baby_stroller_present?: boolean | null;
  child_seat_needed?: boolean | null;
  additional_notes?: string | null;
  collection_confidence?: Record<string, number>;
  last_confirmed_at?: string | null;
  /** Last Meta lifecycle phase sent on WhatsApp (welcome_1, canceled, …) for AI reply tone. */
  last_whatsapp_lifecycle_phase?: string | null;
  /** Last automated lifecycle send timestamp. */
  lifecycle_automation_sent_at?: string | null;
  /** Last automated lifecycle phase sent. */
  lifecycle_automation_phase?: string | null;
  /** All lifecycle phases already sent on this case (welcome_1, data, …). */
  lifecycle_phases_sent?: string[] | null;
};

export type ConsentJson = {
  consent_operational_basis?: boolean;
  consent_future_marketing?: boolean;
  consent_return_transfer_reminders?: boolean;
  consent_partner_offers?: boolean;
  consent_captured_at?: string | null;
  consent_source?: string;
};

export type OfferSignalJson = {
  return_transfer_missing?: boolean;
  return_transfer_eligible?: boolean;
  upgrade_eligible?: boolean;
  partner_offer_eligible?: boolean;
  offer_reason_codes?: string[];
  offer_shown?: boolean;
  offer_accepted?: boolean;
};

/** App-facing row shapes (camelCase), mapped from Supabase/PostgREST (snake_case). */

export type ReservationRow = {
  id: string;
  reservationId: string;
  externalSource: string;
  externalBookingId: string;
  pickupDatetime: Date | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  bookingStatus: string;
  sourcePhone: string | null;
  sourceEmail: string | null;
  sourceLanguageHint: string | null;
  customerName: string | null;
  crmEnrichmentSyncedAt: Date | null;
  crmConfirmationSyncedAt: Date | null;
  lastSyncedAt: Date;
  createdAt: Date;
};

export type CaseRow = {
  id: string;
  reservationId: string;
  caseType: string;
  caseStatus: string;
  enrichmentStatus: string;
  confirmationStatus: string;
  consentStatus: string;
  operationalComplete: boolean;
  currentChannel: string;
  orchestrationState: string;
  priority: number;
  exceptionFlag: boolean;
  humanIntervention: boolean;
  assignedTo: string | null;
  collectedData: CollectedDataJson | null;
  consent: ConsentJson | null;
  offerSignal: OfferSignalJson | null;
  pendingFieldKey: string | null;
  lastCustomerMessageAt: Date | null;
  nextRetryAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  d1ScheduledFor: Date | null;
  manualNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
};

export type ContactRow = {
  id: string;
  reservationId: string;
  phone: string | null;
  email: string | null;
  preferredLanguage: string | null;
  detectedLanguage: string | null;
  confidenceLanguage: string | null;
  relationshipToBooking: string | null;
  doNotContact: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageRow = {
  id: string;
  caseId: string;
  direction: string;
  channel: string;
  body: string;
  providerMessageId: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type BehaviouralEventRow = {
  id: string;
  eventType: string;
  caseId: string | null;
  reservationId: string | null;
  channel: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

export type CrmSyncAttemptRow = {
  id: string;
  caseId: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
};

export type ProviderUsageEventRow = {
  id: string;
  provider: "openai" | "meta" | "infobip" | string;
  operation: string;
  caseId: string | null;
  reservationId: string | null;
  channel: string | null;
  quantity: number;
  unit: string;
  estimatedCostUsd: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};
