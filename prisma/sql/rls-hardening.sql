-- =============================================================================
-- Row-Level Security — vorbereitet, NICHT angewandt
-- =============================================================================
-- Erzeugt am 2026-09-03 aus dem tatsächlichen Schema (nicht von Hand gepflegt).
--
-- ⚠ DIESES SKRIPT ALLEIN GENÜGT NICHT UND DARF NICHT ISOLIERT GEFAHREN WERDEN.
--
-- Ausgangslage, am Datenbestand geprüft:
--   * 54 Tabellen tragen `tenant_id`, 7 nicht (siehe unten).
--   * Genau 1 Tabelle hat heute RLS aktiv — `prisma/sql/rls.sql` wurde hier nie
--     angewandt.
--   * Die Anwendung verbindet als **Table Owner** und umgeht damit jede nicht
--     erzwungene Policy. Deshalb steht überall `FORCE`.
--   * `src/server/db/prisma.ts` setzt den JWT-Claim `request.jwt.claims`
--     **nicht** mehr — er wurde wegen der Ladezeit entfernt.
--
-- Daraus folgt die Reihenfolge. Wird sie verletzt, liefert **jede
-- Leseoperation leer**, für alle Mandanten:
--
--   1. Nicht-Owner-Rolle anlegen und berechtigen (siehe Abschnitt A).
--   2. Claim-Mechanismus in der Anwendung einschalten
--      (`PULSE_RLS_CLAIMS=1`) und die Ladezeit messen.
--   3. `DATABASE_URL`/`DIRECT_URL` auf die neue Rolle umstellen.
--   4. Erst dann dieses Skript fahren.
--   5. `pnpm tsx prisma/scripts/rls-isolation-check.ts` — beweist beide
--      Richtungen: fremder Mandant sieht nichts, eigener sieht alles.
--
-- Rücknahme: Abschnitt D am Ende.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A · Anwendungsrolle (einmalig, Werte anpassen)
-- -----------------------------------------------------------------------------
-- Bewusst auskommentiert: das Anlegen einer Rolle ist eine Infrastruktur-
-- Entscheidung und gehört nicht in ein Skript, das jemand versehentlich fährt.
--
--   CREATE ROLE pulse_app LOGIN PASSWORD '<geheim>';
--   GRANT USAGE ON SCHEMA public TO pulse_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pulse_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pulse_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pulse_app;
--
-- `pulse_app` ist NICHT Owner — nur so greifen die Policies überhaupt.

BEGIN;

-- -----------------------------------------------------------------------------
-- B · Tabellen mit eigener `tenant_id`
-- -----------------------------------------------------------------------------

ALTER TABLE art_epic_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_epic_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON art_epic_allocations;
CREATE POLICY tenant_isolation ON art_epic_allocations FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE arts ENABLE ROW LEVEL SECURITY;
ALTER TABLE arts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON arts;
CREATE POLICY tenant_isolation ON arts FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_events;
CREATE POLICY tenant_isolation ON audit_events FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE azure_devops_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE azure_devops_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON azure_devops_configs;
CREATE POLICY tenant_isolation ON azure_devops_configs FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_allocations;
CREATE POLICY tenant_isolation ON budget_allocations FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE budget_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_candidates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_candidates;
CREATE POLICY tenant_isolation ON budget_candidates FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE budget_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_participants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_participants;
CREATE POLICY tenant_isolation ON budget_participants FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE budget_plan_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plan_revisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_plan_revisions;
CREATE POLICY tenant_isolation ON budget_plan_revisions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE budget_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_rounds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_rounds;
CREATE POLICY tenant_isolation ON budget_rounds FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dependencies;
CREATE POLICY tenant_isolation ON dependencies FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE epic_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE epic_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON epic_approvals;
CREATE POLICY tenant_isolation ON epic_approvals FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE epic_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE epic_solutions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON epic_solutions;
CREATE POLICY tenant_isolation ON epic_solutions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_art_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_art_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_art_links;
CREATE POLICY tenant_isolation ON goal_art_links FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_checkins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_checkins;
CREATE POLICY tenant_isolation ON goal_checkins FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_comments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_comments;
CREATE POLICY tenant_isolation ON goal_comments FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_custom_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_custom_field_defs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_custom_field_defs;
CREATE POLICY tenant_isolation ON goal_custom_field_defs FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_custom_field_values FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_custom_field_values;
CREATE POLICY tenant_isolation ON goal_custom_field_values FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_epic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_epic_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_epic_links;
CREATE POLICY tenant_isolation ON goal_epic_links FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_related_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_related_work FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_related_work;
CREATE POLICY tenant_isolation ON goal_related_work FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE goal_value_stream_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_value_stream_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON goal_value_stream_links;
CREATE POLICY tenant_isolation ON goal_value_stream_links FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON idempotency_keys;
CREATE POLICY tenant_isolation ON idempotency_keys FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE initiative_graph_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_graph_positions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON initiative_graph_positions;
CREATE POLICY tenant_isolation ON initiative_graph_positions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON initiatives;
CREATE POLICY tenant_isolation ON initiatives FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE issue_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_assessments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON issue_assessments;
CREATE POLICY tenant_isolation ON issue_assessments FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE issue_mitigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_mitigations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON issue_mitigations;
CREATE POLICY tenant_isolation ON issue_mitigations FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE issue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON issue_settings;
CREATE POLICY tenant_isolation ON issue_settings FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON issues;
CREATE POLICY tenant_isolation ON issues FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE jira_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jira_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON jira_configs;
CREATE POLICY tenant_isolation ON jira_configs FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON kpis;
CREATE POLICY tenant_isolation ON kpis FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON objectives;
CREATE POLICY tenant_isolation ON objectives FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON outbox_events;
CREATE POLICY tenant_isolation ON outbox_events FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE pi_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pi_standards FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pi_standards;
CREATE POLICY tenant_isolation ON pi_standards FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE program_increments ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_increments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON program_increments;
CREATE POLICY tenant_isolation ON program_increments FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_capabilities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_capabilities;
CREATE POLICY tenant_isolation ON role_capabilities FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE role_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_onboarding FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_onboarding;
CREATE POLICY tenant_isolation ON role_onboarding FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE run_the_business_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_the_business_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON run_the_business_items;
CREATE POLICY tenant_isolation ON run_the_business_items FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE saved_portfolio_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_portfolio_filters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON saved_portfolio_filters;
CREATE POLICY tenant_isolation ON saved_portfolio_filters FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE setup_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_progress FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON setup_progress;
CREATE POLICY tenant_isolation ON setup_progress FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE solutions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON solutions;
CREATE POLICY tenant_isolation ON solutions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE stage_gate_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_gate_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON stage_gate_approvals;
CREATE POLICY tenant_isolation ON stage_gate_approvals FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE stage_gate_approver_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_gate_approver_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON stage_gate_approver_rules;
CREATE POLICY tenant_isolation ON stage_gate_approver_rules FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE stage_gate_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_gate_transitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON stage_gate_transitions;
CREATE POLICY tenant_isolation ON stage_gate_transitions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE strategic_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_themes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON strategic_themes;
CREATE POLICY tenant_isolation ON strategic_themes FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE system_demo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_demo_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON system_demo_items;
CREATE POLICY tenant_isolation ON system_demo_items FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE system_demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_demos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON system_demos;
CREATE POLICY tenant_isolation ON system_demos FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE target_operating_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_operating_models FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON target_operating_models;
CREATE POLICY tenant_isolation ON target_operating_models FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_invites;
CREATE POLICY tenant_isolation ON tenant_invites FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE tenant_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_join_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_join_requests;
CREATE POLICY tenant_isolation ON tenant_join_requests FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE theme_epic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_epic_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON theme_epic_links;
CREATE POLICY tenant_isolation ON theme_epic_links FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON timelines;
CREATE POLICY tenant_isolation ON timelines FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE transformation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_actions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON transformation_actions;
CREATE POLICY tenant_isolation ON transformation_actions FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_role_assignments;
CREATE POLICY tenant_isolation ON user_role_assignments FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE value_stream_guardrail_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_stream_guardrail_targets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON value_stream_guardrail_targets;
CREATE POLICY tenant_isolation ON value_stream_guardrail_targets FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

ALTER TABLE value_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_streams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON value_streams;
CREATE POLICY tenant_isolation ON value_streams FOR ALL
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);


-- -----------------------------------------------------------------------------
-- C · Tabellen ohne eigene `tenant_id`
-- -----------------------------------------------------------------------------
-- Diese sieben hängen am Elternsatz. Sie brauchen deshalb eine Policy, die über
-- ihn joint — genau der Fall, der bei einem pauschalen „RLS anschalten"
-- durchrutscht und die Tabelle entweder ungeschützt oder unlesbar lässt.

-- tenants: der Mandant selbst — die Isolation liegt auf `id`, nicht `tenant_id`.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants FOR ALL
  USING (id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

-- budget_groups → budget_rounds.tenant_id
ALTER TABLE budget_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_groups;
CREATE POLICY tenant_isolation ON budget_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_rounds r
                  WHERE r.id = budget_groups.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM budget_rounds r
                       WHERE r.id = budget_groups.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

-- budget_decisions → budget_rounds.tenant_id
ALTER TABLE budget_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_decisions;
CREATE POLICY tenant_isolation ON budget_decisions FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_rounds r
                  WHERE r.id = budget_decisions.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM budget_rounds r
                       WHERE r.id = budget_decisions.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

-- group_allocations → budget_rounds.tenant_id
ALTER TABLE group_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_allocations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON group_allocations;
CREATE POLICY tenant_isolation ON group_allocations FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_rounds r
                  WHERE r.id = group_allocations.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM budget_rounds r
                       WHERE r.id = group_allocations.round_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

-- budget_group_members → budget_groups → budget_rounds.tenant_id
ALTER TABLE budget_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_group_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON budget_group_members;
CREATE POLICY tenant_isolation ON budget_group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_groups g JOIN budget_rounds r ON r.id = g.round_id
                  WHERE g.id = budget_group_members.group_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM budget_groups g JOIN budget_rounds r ON r.id = g.round_id
                       WHERE g.id = budget_group_members.group_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

-- group_report_outs → budget_groups → budget_rounds.tenant_id
ALTER TABLE group_report_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_report_outs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON group_report_outs;
CREATE POLICY tenant_isolation ON group_report_outs FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_groups g JOIN budget_rounds r ON r.id = g.round_id
                  WHERE g.id = group_report_outs.group_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM budget_groups g JOIN budget_rounds r ON r.id = g.round_id
                       WHERE g.id = group_report_outs.group_id AND r.tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid));

-- tenant_provision_requests: entsteht VOR dem Mandanten und kann deshalb nicht
-- gegen einen Mandanten-Claim gefiltert werden. Bewusst ohne Policy — der
-- Zugriff gehört über die Anwendungsschicht auf Plattform-Admins beschränkt.
-- Wer das ändert, sperrt die Bereitstellung neuer Mandanten aus.

COMMIT;

-- -----------------------------------------------------------------------------
-- D · Rücknahme
-- -----------------------------------------------------------------------------
-- BEGIN;
-- DO $$ DECLARE t text; BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
--     EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
--     EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
--     EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
--   END LOOP;
-- END $$;
-- COMMIT;
