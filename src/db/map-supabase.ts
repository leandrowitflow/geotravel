import type {
  BehaviouralEventRow,
  CaseRow,
  CollectedDataJson,
  ConsentJson,
  ContactRow,
  CrmSyncAttemptRow,
  MessageRow,
  OfferSignalJson,
  ReservationRow,
} from "@/db/schema";

function d(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const t = new Date(String(v));
  return Number.isNaN(t.getTime()) ? null : t;
}

function reqD(v: unknown): Date {
  const x = d(v);
  return x ?? new Date(0);
}

export function mapReservation(r: Record<string, unknown>): ReservationRow {
  return {
    id: String(r.id),
    reservationId: String(r.reservation_id),
    externalSource: String(r.external_source),
    externalBookingId: String(r.external_booking_id),
    pickupDatetime: d(r.pickup_datetime),
    pickupLocation: (r.pickup_location as string) ?? null,
    dropoffLocation: (r.dropoff_location as string) ?? null,
    bookingStatus: String(r.booking_status ?? "active"),
    sourcePhone: (r.source_phone as string) ?? null,
    sourceEmail: (r.source_email as string) ?? null,
    sourceLanguageHint: (r.source_language_hint as string) ?? null,
    customerName: (r.customer_name as string) ?? null,
    crmEnrichmentSyncedAt: d(r.crm_enrichment_synced_at),
    crmConfirmationSyncedAt: d(r.crm_confirmation_synced_at),
    lastSyncedAt: reqD(r.last_synced_at),
    createdAt: reqD(r.created_at),
  };
}

export function mapCase(r: Record<string, unknown>): CaseRow {
  return {
    id: String(r.id),
    reservationId: String(r.reservation_id),
    caseType: String(r.case_type ?? "enrichment"),
    caseStatus: String(r.case_status ?? "active"),
    enrichmentStatus: String(r.enrichment_status ?? "pending"),
    confirmationStatus: String(r.confirmation_status ?? "pending"),
    consentStatus: String(r.consent_status ?? "pending"),
    operationalComplete: Boolean(r.operational_complete),
    currentChannel: String(r.current_channel ?? "whatsapp"),
    orchestrationState: String(r.orchestration_state ?? "awaiting_outreach"),
    priority: Number(r.priority ?? 0),
    exceptionFlag: Boolean(r.exception_flag),
    humanIntervention: Boolean(r.human_intervention),
    assignedTo: (r.assigned_to as string) ?? null,
    collectedData: (r.collected_data as CollectedDataJson) ?? null,
    consent: (r.consent as ConsentJson) ?? null,
    offerSignal: (r.offer_signal as OfferSignalJson) ?? null,
    pendingFieldKey: (r.pending_field_key as string) ?? null,
    lastCustomerMessageAt: d(r.last_customer_message_at),
    nextRetryAt: d(r.next_retry_at),
    attemptCount: Number(r.attempt_count ?? 0),
    maxAttempts: Number(r.max_attempts ?? 5),
    d1ScheduledFor: d(r.d1_scheduled_for),
    manualNote: (r.manual_note as string) ?? null,
    createdAt: reqD(r.created_at),
    updatedAt: reqD(r.updated_at),
    closedAt: d(r.closed_at),
  };
}

export function mapContact(r: Record<string, unknown>): ContactRow {
  return {
    id: String(r.id),
    reservationId: String(r.reservation_id),
    phone: (r.phone as string) ?? null,
    email: (r.email as string) ?? null,
    preferredLanguage: (r.preferred_language as string) ?? "en",
    detectedLanguage: (r.detected_language as string) ?? null,
    confidenceLanguage: (r.confidence_language as string) ?? null,
    relationshipToBooking: (r.relationship_to_booking as string) ?? null,
    doNotContact: Boolean(r.do_not_contact),
    createdAt: reqD(r.created_at),
    updatedAt: reqD(r.updated_at),
  };
}

export function mapMessage(r: Record<string, unknown>): MessageRow {
  return {
    id: String(r.id),
    caseId: String(r.case_id),
    direction: String(r.direction),
    channel: String(r.channel),
    body: String(r.body),
    providerMessageId: (r.provider_message_id as string) ?? null,
    status: String(r.status ?? "queued"),
    metadata: (r.metadata as Record<string, unknown>) ?? null,
    createdAt: reqD(r.created_at),
  };
}

export function mapBehaviouralEvent(
  r: Record<string, unknown>,
): BehaviouralEventRow {
  return {
    id: String(r.id),
    eventType: String(r.event_type),
    caseId: r.case_id != null ? String(r.case_id) : null,
    reservationId: r.reservation_id != null ? String(r.reservation_id) : null,
    channel: (r.channel as string) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? null,
    createdAt: reqD(r.created_at),
  };
}

export function mapCrmSyncAttempt(
  r: Record<string, unknown>,
): CrmSyncAttemptRow {
  return {
    id: String(r.id),
    caseId: String(r.case_id),
    kind: String(r.kind),
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: String(r.status),
    errorMessage: (r.error_message as string) ?? null,
    createdAt: reqD(r.created_at),
  };
}
