-- LISTEN/NOTIFY trigger so the dashboard /snippets panel refreshes live.
DROP TRIGGER IF EXISTS snippet_validations_notify ON "snippet_validations";--> statement-breakpoint
CREATE TRIGGER snippet_validations_notify
AFTER INSERT OR UPDATE OR DELETE ON "snippet_validations"
FOR EACH ROW EXECUTE FUNCTION forge_notify();
