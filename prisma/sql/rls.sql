-- =============================================================================
-- Row-Level Security Policies
-- =============================================================================
-- Apply after prisma/sql/invariants.sql.
-- Run: psql $DATABASE_URL -f prisma/sql/rls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tenant-scoped tables
-- ---------------------------------------------------------------------------

ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_streams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE arts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_increments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints               ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: extract tenant_id from the JWT set by the Prisma client
-- (mirrors what Supabase Auth does when using GoTrue directly)
-- ---------------------------------------------------------------------------
-- Usage: (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid

-- ---------------------------------------------------------------------------
-- Tenant isolation — the primary guardrail
-- Every table with a tenant_id column gets this policy.
-- ---------------------------------------------------------------------------

-- value_streams
CREATE POLICY tenant_isolation_value_streams ON value_streams
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- arts
CREATE POLICY tenant_isolation_arts ON arts
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- program_increments
CREATE POLICY tenant_isolation_pis ON program_increments
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- sprints
CREATE POLICY tenant_isolation_sprints ON sprints
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- initiatives
CREATE POLICY tenant_isolation_initiatives ON initiatives
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- dependencies
CREATE POLICY tenant_isolation_dependencies ON dependencies
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- user_role_assignments
CREATE POLICY tenant_isolation_user_roles ON user_role_assignments
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- outbox_events
CREATE POLICY tenant_isolation_outbox ON outbox_events
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- Audit log: append-only — SELECT and INSERT only, no UPDATE or DELETE
-- ---------------------------------------------------------------------------

CREATE POLICY tenant_isolation_audit_read ON audit_events
  FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

CREATE POLICY audit_insert_own_tenant ON audit_events
  FOR INSERT
  WITH CHECK (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );

-- Explicitly deny UPDATE and DELETE on audit_events (defence in depth)
CREATE POLICY audit_no_update ON audit_events
  FOR UPDATE USING (false);

CREATE POLICY audit_no_delete ON audit_events
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- Task-owner scoped UPDATE: task owners can only update initiatives
-- where they appear as an assignee
-- ---------------------------------------------------------------------------

CREATE POLICY task_owner_update ON initiatives
  FOR UPDATE
  USING (
    level = 3
    AND (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid = ANY(assignee_ids)
    AND tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  );
