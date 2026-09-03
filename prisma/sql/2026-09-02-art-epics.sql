-- =============================================================================
-- ART-Epics, Guardrail 3 und Budget-Transparenz — DDL
-- =============================================================================
-- Von Hand anzuwenden, VOR dem Deploy des zugehörigen Codes:
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-02-art-epics.sql
--
-- `prisma db push` NICHT verwenden: es würde die unentschiedene Altlast
-- (epic_approvals, approval_phase, approval_revision) fallen lassen.
--
-- Jede Änderung ist rückwärtskompatibel — die laufende Anwendung arbeitet mit
-- dem neuen Schema unverändert weiter:
--   * neue Spalten sind nullable oder haben einen verhaltenswahrenden Default
--   * neue Tabellen liest vor dem Deploy niemand
-- Idempotent (IF NOT EXISTS), damit ein zweiter Lauf nichts kaputt macht.
-- =============================================================================

BEGIN;

-- --- PR12 · Run the Business je ART -----------------------------------------
-- `art_id` NULL = wertstrom-übergreifend (heutiges Verhalten).
-- `kind` DEFAULT 'run' = Betrieb; 'art_change' ist der Veränderungsrahmen.
ALTER TABLE run_the_business_items
  ADD COLUMN IF NOT EXISTS art_id UUID REFERENCES arts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind   TEXT NOT NULL DEFAULT 'run';

CREATE INDEX IF NOT EXISTS run_the_business_items_art_id_idx
  ON run_the_business_items (art_id);

-- --- PR14 · Guardrail-3-Ausnahme am Epic ------------------------------------
-- Gesetzter Stempel = Ausnahme aktiv. Ohne Wert gilt die reine Kostenregel.
ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS portfolio_override_at     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS portfolio_override_by     UUID,
  ADD COLUMN IF NOT EXISTS portfolio_override_reason TEXT;

-- --- PR10 · Guardrail-Ziele je Wertstrom ------------------------------------
-- Nur Wertstrom-Zeilen; der Tenant-Default bleibt in tenants.guardrail_targets.
CREATE TABLE IF NOT EXISTS value_stream_guardrail_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants (id),
  value_stream_id UUID NOT NULL REFERENCES value_streams (id) ON DELETE CASCADE,
  targets         JSONB NOT NULL,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL,
  updated_by      UUID NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS value_stream_guardrail_targets_tenant_vs_key
  ON value_stream_guardrail_targets (tenant_id, value_stream_id);
CREATE INDEX IF NOT EXISTS value_stream_guardrail_targets_tenant_idx
  ON value_stream_guardrail_targets (tenant_id);

-- --- PR15 · Ledger der ART-Verteilung ---------------------------------------
CREATE TABLE IF NOT EXISTS art_epic_allocations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants (id),
  art_id     UUID NOT NULL REFERENCES arts (id) ON DELETE CASCADE,
  epic_id    UUID NOT NULL REFERENCES initiatives (id) ON DELETE CASCADE,
  cycle_key  TEXT NOT NULL,
  amount     DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ask        DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  updated_by UUID NOT NULL
);

-- Ein Epic bekommt je ART und Halbjahr höchstens eine Zeile.
CREATE UNIQUE INDEX IF NOT EXISTS art_epic_allocations_art_epic_cycle_key
  ON art_epic_allocations (art_id, epic_id, cycle_key);
CREATE INDEX IF NOT EXISTS art_epic_allocations_tenant_cycle_idx
  ON art_epic_allocations (tenant_id, cycle_key);

COMMIT;

-- Danach: prisma/sql/rls.sql erneut anwenden, damit die neuen Tabellen ihre
-- Row-Level-Security-Policies bekommen (PR4b).
