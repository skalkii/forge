-- forge_notify() already exists (0001); attach it to github_requests so the
-- dashboard budget meter updates live.
DROP TRIGGER IF EXISTS github_requests_notify ON github_requests;
--> statement-breakpoint
CREATE TRIGGER github_requests_notify
AFTER INSERT OR UPDATE OR DELETE ON github_requests
FOR EACH ROW EXECUTE FUNCTION forge_notify();
