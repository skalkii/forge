CREATE TABLE "signup_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" "outcome_event" NOT NULL,
	"utm_campaign" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb,
	"processed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "signup_events_processed_idx" ON "signup_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_touch_event_uq" ON "outcomes" USING btree ("touch_id","event");