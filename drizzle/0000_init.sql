CREATE TABLE "behavioural_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"case_id" uuid,
	"reservation_id" uuid,
	"channel" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"case_type" text DEFAULT 'enrichment' NOT NULL,
	"case_status" text DEFAULT 'active' NOT NULL,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"confirmation_status" text DEFAULT 'pending' NOT NULL,
	"consent_status" text DEFAULT 'pending' NOT NULL,
	"operational_complete" boolean DEFAULT false NOT NULL,
	"current_channel" text DEFAULT 'whatsapp' NOT NULL,
	"orchestration_state" text DEFAULT 'awaiting_outreach' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"exception_flag" boolean DEFAULT false NOT NULL,
	"human_intervention" boolean DEFAULT false NOT NULL,
	"assigned_to" text,
	"collected_data" jsonb,
	"consent" jsonb,
	"offer_signal" jsonb,
	"pending_field_key" text,
	"last_customer_message_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"d1_scheduled_for" timestamp with time zone,
	"manual_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"phone" text,
	"email" text,
	"preferred_language" text DEFAULT 'en',
	"detected_language" text,
	"confidence_language" text,
	"relationship_to_booking" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_sync_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"channel" text NOT NULL,
	"body" text NOT NULL,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" text NOT NULL,
	"external_source" text NOT NULL,
	"external_booking_id" text NOT NULL,
	"pickup_datetime" timestamp with time zone,
	"pickup_location" text,
	"dropoff_location" text,
	"booking_status" text DEFAULT 'active' NOT NULL,
	"source_phone" text,
	"source_email" text,
	"source_language_hint" text,
	"customer_name" text,
	"crm_enrichment_synced_at" timestamp with time zone,
	"crm_confirmation_synced_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
ALTER TABLE "behavioural_events" ADD CONSTRAINT "behavioural_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavioural_events" ADD CONSTRAINT "behavioural_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sync_attempts" ADD CONSTRAINT "crm_sync_attempts_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "be_case_idx" ON "behavioural_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "be_type_idx" ON "behavioural_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "cases_reservation_idx" ON "cases" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "crm_sync_case_idx" ON "crm_sync_attempts" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "messages_case_idx" ON "messages" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "res_ext_booking" ON "reservations" USING btree ("external_source","external_booking_id");