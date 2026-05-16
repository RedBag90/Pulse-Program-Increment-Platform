-- =============================================================================
-- Hierarchy Invariants — CHECK constraints on the initiatives table
-- =============================================================================
-- Apply after the Prisma-generated initial migration.
-- Run: psql $DATABASE_URL -f prisma/sql/invariants.sql
-- =============================================================================

ALTER TABLE initiatives
  -- I1: level must be 0..3
  ADD CONSTRAINT i1_level_range
    CHECK (level BETWEEN 0 AND 3),

  -- I2: Epics (level=0) must have no parent; all others must have a parent
  ADD CONSTRAINT i2_epic_no_parent
    CHECK (
      (level = 0 AND parent_id IS NULL) OR
      (level > 0 AND parent_id IS NOT NULL)
    ),

  -- I3: WSJF fields only on Features (level=1)
  ADD CONSTRAINT i3_wsjf_only_features
    CHECK (
      (level = 1) = (wsjf_business_value IS NOT NULL)
    ),

  -- I4: PI required for Features (level=1) and Stories (level=2)
  ADD CONSTRAINT i4_pi_for_feature_story
    CHECK (
      (level IN (1, 2)) = (pi_id IS NOT NULL)
    ),

  -- I5: Sprint required for Stories (level=2) only
  ADD CONSTRAINT i5_sprint_for_story
    CHECK (
      (level = 2) = (sprint_id IS NOT NULL)
    ),

  -- Story points only on Stories (level=2)
  ADD CONSTRAINT i6_story_points_only_for_stories
    CHECK (
      (level = 2) = (story_points IS NOT NULL)
    ),

  -- Estimate hours only on Tasks (level=3)
  ADD CONSTRAINT i7_estimate_only_for_tasks
    CHECK (
      (level = 3) = (estimate_hours IS NOT NULL)
    ),

  -- Lean Business Case JSON only on Epics (level=0)
  ADD CONSTRAINT i8_lbc_only_for_epics
    CHECK (
      (level = 0) OR (lean_business_case IS NULL)
    ),

  -- Value stream only on Epics (level=0)
  ADD CONSTRAINT i9_value_stream_only_for_epics
    CHECK (
      (level = 0) = (value_stream_id IS NOT NULL)
    ),

  -- ART only on Features (level=1)
  ADD CONSTRAINT i10_art_only_for_features
    CHECK (
      (level = 1) = (art_id IS NOT NULL)
    );

-- Cycle prevention trigger: reject inserts/updates where path contains own id
-- (materialized path prevents direct DB cycles; application layer enforces graph cycles)
CREATE OR REPLACE FUNCTION check_no_self_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'An initiative cannot be its own parent (id: %)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_self_cycle
  BEFORE INSERT OR UPDATE ON initiatives
  FOR EACH ROW EXECUTE FUNCTION check_no_self_cycle();

-- Cross-tenant parent check trigger
CREATE OR REPLACE FUNCTION check_same_tenant_parent()
RETURNS TRIGGER AS $$
DECLARE
  parent_tenant_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO parent_tenant_id
  FROM initiatives
  WHERE id = NEW.parent_id;

  IF parent_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant parent relationship is forbidden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_same_tenant_parent
  BEFORE INSERT OR UPDATE ON initiatives
  FOR EACH ROW EXECUTE FUNCTION check_same_tenant_parent();
