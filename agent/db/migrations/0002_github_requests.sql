CREATE TABLE "github_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" text NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status" integer,
	"rate_limit" integer,
	"rate_remaining" integer,
	"rate_reset_at" timestamp with time zone,
	"latency_ms" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "github_requests_at_idx" ON "github_requests" USING btree ("at");--> statement-breakpoint
CREATE INDEX "github_requests_resource_idx" ON "github_requests" USING btree ("resource");