-- Custom SQL migration file, put your code below! --
DROP TRIGGER IF EXISTS retrieval_cache_notify ON retrieval_cache;
--> statement-breakpoint
CREATE TRIGGER retrieval_cache_notify
AFTER INSERT OR UPDATE OR DELETE ON retrieval_cache
FOR EACH ROW EXECUTE FUNCTION forge_notify();
