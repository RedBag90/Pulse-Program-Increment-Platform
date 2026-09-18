-- Drei weitere namentlich benannte Personen in der Struktur.
--
--   value_streams.business_owner_id  — fachliche Priorität und Nutzen.
--                                      Vorbelegung der Epic-Partei
--                                      `epic.party.business_owner` an L2 → L3.1
--                                      (ADR-0018, Nachtrag).
--   value_streams.architect_lead_id  — Architektur und Machbarkeit. Als
--                                      Platzhalter verfügbar, in keiner
--                                      Code-Vorgabe eingetragen.
--   arts.technical_lead_id           — technisch Verantwortliche:r des ARTs.
--                                      Vorerst nur benannt, ohne Wirkung.
--
-- Lose User-Ids ohne FK: es gibt kein `User`-Modell, Nutzer leben in Supabase
-- Auth — dasselbe Muster wie `finance_approver_id`, `vmo_id`, `rte_id` und
-- `solutions.product_manager_id`.
--
-- Prisma könnte das ausdrücken; die Anweisungen laufen nur von Hand, weil
-- `prisma db push` gesperrt ist. Auf einer frischen Datenbank entsteht derselbe
-- Stand direkt aus `schema.prisma` — diese Datei ist das Protokoll des
-- Eingriffs, keine dauerhafte Voraussetzung.
--
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-18-named-people-vs-art.sql
--
-- Angewandt am 2026-09-18 auf der Projektdatenbank. Additiv, nichts Destruktives.

ALTER TABLE value_streams ADD COLUMN IF NOT EXISTS business_owner_id uuid;
ALTER TABLE value_streams ADD COLUMN IF NOT EXISTS architect_lead_id uuid;
ALTER TABLE arts ADD COLUMN IF NOT EXISTS technical_lead_id uuid;
