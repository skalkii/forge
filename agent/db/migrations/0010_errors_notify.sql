-- LISTEN/NOTIFY trigger so the dashboard /errors panel refreshes live.
DROP TRIGGER IF EXISTS errors_notify ON "errors";--> statement-breakpoint
CREATE TRIGGER errors_notify
AFTER INSERT OR UPDATE OR DELETE ON "errors"
FOR EACH ROW EXECUTE FUNCTION forge_notify();
