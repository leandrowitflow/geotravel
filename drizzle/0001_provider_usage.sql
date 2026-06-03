CREATE TABLE "provider_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"case_id" uuid,
	"reservation_id" uuid,
	"channel" text,
	"quantity" numeric(14, 4) DEFAULT 0 NOT NULL,
	"unit" text NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "provider_usage_provider_idx" ON "provider_usage_events" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "provider_usage_created_idx" ON "provider_usage_events" USING btree ("created_at");
