ALTER TABLE "signals" ADD COLUMN "embedding" vector(384);--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "dup_of" uuid;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_dup_of_signals_id_fk" FOREIGN KEY ("dup_of") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;