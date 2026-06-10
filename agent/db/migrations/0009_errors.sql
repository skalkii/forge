CREATE TABLE "errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"candidate_id" uuid,
	"run_id" uuid,
	"context" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "errors" ADD CONSTRAINT "errors_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "errors_at_idx" ON "errors" USING btree ("at");--> statement-breakpoint
CREATE INDEX "errors_source_idx" ON "errors" USING btree ("source");