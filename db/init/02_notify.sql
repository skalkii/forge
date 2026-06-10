-- Generic change-notification trigger. Every app table gets:
--   CREATE TRIGGER <t>_notify AFTER INSERT OR UPDATE OR DELETE ON <t>
--     FOR EACH ROW EXECUTE FUNCTION forge_notify();
-- Payload stays tiny (id only, 8KB NOTIFY limit) — clients refetch the row.
CREATE OR REPLACE FUNCTION forge_notify() RETURNS trigger AS $$
DECLARE
  row_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id = OLD.id::text;
  ELSE
    row_id = NEW.id::text;
  END IF;
  PERFORM pg_notify(
    'forge_events',
    json_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'id', row_id, 'at', now())::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
