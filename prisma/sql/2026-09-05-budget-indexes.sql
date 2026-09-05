-- Indizes für die Budget-Flächen (Stufe 1 des Modul-Umbaus).
--
-- `prisma db push` bleibt gesperrt, solange die Alt-Migration offen ist; die
-- Anweisungen laufen deshalb von Hand. Sie sind additiv und idempotent.
--
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-05-budget-indexes.sql

-- Die häufigste Abfrage des Moduls: das ART-Epic-Budget eines ARTs
-- (`{ tenantId, artId, kind: "art_change", active: true }`). Traf bisher nur
-- `(tenant_id, value_stream_id)` und filterte den Rest im Heap.
CREATE INDEX IF NOT EXISTS run_the_business_items_tenant_art_kind_active
  ON run_the_business_items (tenant_id, art_id, kind, active);

-- Kandidaten werden nach Art **und** Träger gefiltert — acht heisse Formen
-- fielen auf `(tenant_id)` zurück.
CREATE INDEX IF NOT EXISTS budget_candidates_tenant_kind_art
  ON budget_candidates (tenant_id, kind, art_id);
CREATE INDEX IF NOT EXISTS budget_candidates_tenant_kind_value_stream
  ON budget_candidates (tenant_id, kind, value_stream_id);

-- `(art_id, epic_id, cycle_key)` ist unique, aber `cycle_key` ist darin kein
-- nutzbares Praefix; `(tenant_id, cycle_key)` filtert `art_id` im Heap.
CREATE INDEX IF NOT EXISTS art_epic_allocations_tenant_art_cycle
  ON art_epic_allocations (tenant_id, art_id, cycle_key);
