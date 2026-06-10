-- LISTEN/NOTIFY trigger so the dashboard refreshes live when stub signup events land.
DROP TRIGGER IF EXISTS signup_events_notify ON "signup_events";--> statement-breakpoint
CREATE TRIGGER signup_events_notify
AFTER INSERT OR UPDATE OR DELETE ON "signup_events"
FOR EACH ROW EXECUTE FUNCTION forge_notify();
