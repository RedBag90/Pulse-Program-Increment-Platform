-- Dependency cycle guard — technical-concept invariant I7.
-- Final guardrail: rejects an INSERT into `dependencies` that would close a
-- directional cycle. The application layer (linkDependency) checks this too;
-- the trigger ensures the invariant holds even if application code is bypassed.
-- `relates_to` edges are non-directional and exempt from cycle checks.

CREATE OR REPLACE FUNCTION check_dependency_cycle() RETURNS trigger AS $$
BEGIN
  IF NEW.from_id = NEW.to_id THEN
    RAISE EXCEPTION 'An initiative cannot depend on itself';
  END IF;

  IF NEW.type = 'relates_to' THEN
    RETURN NEW;
  END IF;

  -- Walk directional edges forward from NEW.to_id. If NEW.from_id is reachable,
  -- adding from_id -> to_id closes a cycle.
  IF EXISTS (
    WITH RECURSIVE reachable AS (
      SELECT to_id
        FROM dependencies
        WHERE from_id = NEW.to_id
          AND type <> 'relates_to'
          AND tenant_id = NEW.tenant_id
      UNION
      SELECT d.to_id
        FROM dependencies d
        JOIN reachable r ON d.from_id = r.to_id
        WHERE d.type <> 'relates_to'
          AND d.tenant_id = NEW.tenant_id
    )
    SELECT 1 FROM reachable WHERE to_id = NEW.from_id
  ) THEN
    RAISE EXCEPTION 'Dependency would create a circular dependency chain';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dependency_cycle_check ON dependencies;
CREATE TRIGGER dependency_cycle_check
  BEFORE INSERT ON dependencies
  FOR EACH ROW EXECUTE FUNCTION check_dependency_cycle();
