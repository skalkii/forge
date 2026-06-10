CREATE TABLE "snippet_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"status" text NOT NULL,
	"output" text,
	"duration_ms" integer NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "snippet_validations_template_idx" ON "snippet_validations" USING btree ("template_id");