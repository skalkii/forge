CREATE TABLE "retrieval_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"request_hash" text NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"cost_usd" real NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retrieval_cache_request_hash_unique" UNIQUE("request_hash")
);
--> statement-breakpoint
CREATE INDEX "retrieval_cache_provider_idx" ON "retrieval_cache" USING btree ("provider");