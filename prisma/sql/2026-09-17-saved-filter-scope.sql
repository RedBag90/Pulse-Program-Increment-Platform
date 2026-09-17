-- Gespeicherte Filter bekommen eine Fläche (`scope`).
--
-- `SavedPortfolioFilter` heißt seit dem Ausbau `SavedFilter` und trägt jetzt
-- auch die Filter der Ziele-Fläche. Ohne `scope` könnte niemand „Q4" für beide
-- Flächen führen — der alte Eindeutigkeits-Index lief über
-- (tenant_id, user_id, name).
--
-- Der **Tabellenname bleibt** `saved_portfolio_filters`, obwohl darin jetzt auch
-- Ziele-Filter liegen: ein Rename kostet RLS-Policy, Seed-Teardown und
-- Audit-ResourceType für null Gewinn.
--
-- Prisma könnte das ausdrücken; die Anweisungen laufen nur deshalb von Hand,
-- weil `prisma db push` gesperrt ist. Auf einer frischen Datenbank entsteht
-- derselbe Stand direkt aus `schema.prisma` — diese Datei ist das Protokoll des
-- Eingriffs, keine dauerhafte Voraussetzung.
--
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-17-saved-filter-scope.sql
--
-- Angewandt am 2026-09-16 auf der Projektdatenbank.

ALTER TABLE saved_portfolio_filters
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'portfolio';

-- Prismas `@@unique` erzeugt einen **Index**, keine Constraint — ein erster
-- Versuch mit `DROP CONSTRAINT` scheiterte und rollte sauber zurück.
DROP INDEX IF EXISTS saved_portfolio_filters_tenant_id_user_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS saved_portfolio_filters_tenant_id_user_id_scope_name_key
  ON saved_portfolio_filters (tenant_id, user_id, scope, name);
