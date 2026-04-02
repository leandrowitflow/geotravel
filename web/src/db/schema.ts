import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type CollectedDataJson = {
  passenger_count_actual?: number | null;
  children_count?: number | null;
  child_ages?: number[] | null;
  special_luggage_present?: boolean | null;
  special_luggage_types?: string[] | null;
  reduced_mobility_present?: boolean | null;
  reduced_mobility_notes?: string | null;
  baby_stroller_present?: boolean | null;
  child_seat_needed?: boolean | null;
  additional_notes?: string | null;
  collection_confidence?: Record<string, number>;
  last_confirmed_at?: string | null;
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

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: text("reservation_id").notNull().unique(),
    externalSource: text("external_source").notNull(),
    externalBookingId: text("external_booking_id").notNull(),
    pickupDatetime: timestamp("pickup_datetime", { withTimezone: true }),
    pickupLocation: text("pickup_location"),
    dropoffLocation: text("dropoff_location"),
    bookingStatus: text("booking_status").notNull().default("active"),
    sourcePhone: text("source_phone"),
    sourceEmail: text("source_email"),
    sourceLanguageHint: text("source_language_hint"),
    customerName: text("customer_name"),
    /** Stub CRM mirror fields */
    crmEnrichmentSyncedAt: timestamp("crm_enrichment_synced_at", {
      withTimezone: true,
    }),
    crmConfirmationSyncedAt: timestamp("crm_confirmation_synced_at", {
      withTimezone: true,
    }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("res_ext_booking").on(t.externalSource, t.externalBookingId),
  ],
);

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  reservationId: uuid("reservation_id")
    .notNull()
    .references(() => reservations.id, { onDelete: "cascade" }),
  phone: text("phone"),
  email: text("email"),
  preferredLanguage: text("preferred_language").default("en"),
  detectedLanguage: text("detected_language"),
  confidenceLanguage: text("confidence_language"),
  relationshipToBooking: text("relationship_to_booking"),
  doNotContact: boolean("do_not_contact").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    caseType: text("case_type").notNull().default("enrichment"),
    caseStatus: text("case_status").notNull().default("active"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    confirmationStatus: text("confirmation_status").notNull().default("pending"),
    consentStatus: text("consent_status").notNull().default("pending"),
    operationalComplete: boolean("operational_complete").notNull().default(false),
    currentChannel: text("current_channel").notNull().default("whatsapp"),
    orchestrationState: text("orchestration_state")
      .notNull()
      .default("awaiting_outreach"),
    priority: integer("priority").notNull().default(0),
    exceptionFlag: boolean("exception_flag").notNull().default(false),
    humanIntervention: boolean("human_intervention").notNull().default(false),
    assignedTo: text("assigned_to"),
    collectedData: jsonb("collected_data").$type<CollectedDataJson>(),
    consent: jsonb("consent").$type<ConsentJson>(),
    offerSignal: jsonb("offer_signal").$type<OfferSignalJson>(),
    pendingFieldKey: text("pending_field_key"),
    lastCustomerMessageAt: timestamp("last_customer_message_at", {
      withTimezone: true,
    }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    d1ScheduledFor: timestamp("d1_scheduled_for", { withTimezone: true }),
    manualNote: text("manual_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("cases_reservation_idx").on(t.reservationId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    channel: text("channel").notNull(),
    body: text("body").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().default("queued"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_case_idx").on(t.caseId)],
);

export const behaviouralEvents = pgTable(
  "behavioural_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "set null",
    }),
    channel: text("channel"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("be_case_idx").on(t.caseId),
    index("be_type_idx").on(t.eventType),
  ],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const crmSyncAttempts = pgTable(
  "crm_sync_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("crm_sync_case_idx").on(t.caseId)],
);
