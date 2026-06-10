CREATE TYPE "public"."candidate_status" AS ENUM('queued', 'enriching', 'qualifying', 'crafting', 'review', 'approved', 'rejected', 'posted', 'activated', 'dropped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'ended');--> statement-breakpoint
CREATE TYPE "public"."outcome_event" AS ENUM('signup', 'first_successful_api_call');--> statement-breakpoint
CREATE TYPE "public"."touch_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"subject_table" text,
	"subject_id" text,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"status" "candidate_status" DEFAULT 'queued' NOT NULL,
	"triage_score" real,
	"triage_reason" text,
	"fit_score" real,
	"capability" text,
	"qualify_reasons" jsonb,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_signal_id_unique" UNIQUE("signal_id")
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"candidate_id" uuid,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" real NOT NULL,
	"meta" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hypothesis" text NOT NULL,
	"variable" text NOT NULL,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "experiments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"touch_id" uuid NOT NULL,
	"event" "outcome_event" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'github' NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"repo" text NOT NULL,
	"author" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"query" text NOT NULL,
	"found_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "touches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"experiment_id" uuid,
	"variant" text,
	"template_id" text,
	"draft_body" text NOT NULL,
	"final_body" text,
	"disclosure_ok" boolean DEFAULT false NOT NULL,
	"decision" "touch_decision",
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"posted_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_touch_id_touches_id_fk" FOREIGN KEY ("touch_id") REFERENCES "public"."touches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touches" ADD CONSTRAINT "touches_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touches" ADD CONSTRAINT "touches_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "candidates_status_idx" ON "candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cost_events_at_idx" ON "cost_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "outcomes_touch_idx" ON "outcomes" USING btree ("touch_id");--> statement-breakpoint
CREATE INDEX "signals_author_idx" ON "signals" USING btree ("author");--> statement-breakpoint
CREATE INDEX "signals_created_idx" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "touches_candidate_idx" ON "touches" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "touches_experiment_idx" ON "touches" USING btree ("experiment_id");