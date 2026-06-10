-- forge_notify() + change triggers for every domain table.
-- Also defined in db/init/02_notify.sql for fresh docker volumes; this
-- migration is the authoritative copy (CREATE OR REPLACE keeps both safe).
-- Payload stays tiny (id only — 8KB NOTIFY limit); clients refetch the row.
-- Reads the id via to_jsonb so tables with a non-"id" PK (settings) don't error.
CREATE OR REPLACE FUNCTION forge_notify() RETURNS trigger AS $$
DECLARE
  row_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id = COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'key');
  ELSE
    row_id = COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'key');
  END IF;
  PERFORM pg_notify(
    'forge_events',
    json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'id', row_id, 'at', now())::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS signals_notify ON "signals";
--> statement-breakpoint
CREATE TRIGGER signals_notify AFTER INSERT OR UPDATE OR DELETE ON "signals" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS candidates_notify ON "candidates";
--> statement-breakpoint
CREATE TRIGGER candidates_notify AFTER INSERT OR UPDATE OR DELETE ON "candidates" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS experiments_notify ON "experiments";
--> statement-breakpoint
CREATE TRIGGER experiments_notify AFTER INSERT OR UPDATE OR DELETE ON "experiments" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touches_notify ON "touches";
--> statement-breakpoint
CREATE TRIGGER touches_notify AFTER INSERT OR UPDATE OR DELETE ON "touches" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS outcomes_notify ON "outcomes";
--> statement-breakpoint
CREATE TRIGGER outcomes_notify AFTER INSERT OR UPDATE OR DELETE ON "outcomes" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS cost_events_notify ON "cost_events";
--> statement-breakpoint
CREATE TRIGGER cost_events_notify AFTER INSERT OR UPDATE OR DELETE ON "cost_events" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_notify ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_notify AFTER INSERT OR UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION forge_notify();
--> statement-breakpoint
DROP TRIGGER IF EXISTS settings_notify ON "settings";
--> statement-breakpoint
CREATE TRIGGER settings_notify AFTER INSERT OR UPDATE OR DELETE ON "settings" FOR EACH ROW EXECUTE FUNCTION forge_notify();
