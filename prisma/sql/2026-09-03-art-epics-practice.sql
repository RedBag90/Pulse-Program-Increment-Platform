-- =============================================================================
-- Practice `artEpics` am Zielbild — DDL
-- =============================================================================
--   set -a; . ./.env.local; set +a
--   npx prisma db execute --file prisma/sql/2026-09-03-art-epics-practice.sql --url "$DIRECT_URL"
--
-- Additiv und idempotent. Default `false`: Bestandsmandanten verhalten sich
-- unverändert — die Practice leitet Geldflüsse um und geht nicht von selbst an.
--
-- Ohne diese Spalte liest `effectivePractices` ins Leere und fällt immer auf
-- `false` zurück: der Rollout-Schalter wäre je Mandant nicht einschaltbar.
-- =============================================================================

ALTER TABLE target_operating_models
  ADD COLUMN IF NOT EXISTS art_epics BOOLEAN NOT NULL DEFAULT false;
