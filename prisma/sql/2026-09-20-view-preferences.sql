-- Ansichts-Vorlieben je Nutzer: `view_preferences`.
--
-- Die Kachel „Epic-Beitrag zu Kopf-Zielen" hielt ihre beiden Schalter
-- (Zusammenfassung, Sortierung) in `useState` — nach jedem Seitenaufruf standen
-- sie wieder auf der Voreinstellung. Entschieden wurde gegen `localStorage` und
-- für eine Ablage am Konto: die Einstellung folgt auf jedes Gerät, und sie ist
-- schon beim ersten Bildaufbau da (der vorhandene Haken `useLocalStorageState`
-- lädt erst nach dem Mount — die Tabelle würde sichtbar einmal umsortieren).
--
-- **Generisch, nicht je Kachel.** `key` benennt die Fläche, `value` trägt deren
-- Zustand als JSON. Der eingeklappte Ziel-Baum und der „+ n weitere"-Zustand
-- des Kanbans warten schon; eine Tabelle je Kachel wäre der teurere Weg zum
-- selben Ziel.
--
-- **Nicht `saved_portfolio_filters`.** Dort steht `name` im
-- Eindeutigkeits-Schlüssel: die Tabelle führt *benannte, selbst angelegte*
-- Filter. Eine Vorliebe hat keinen Namen — sie gilt einfach.
--
-- Rein persönlich, wie `role_onboarding`: die RLS-Politik prüft `tenant_id`
-- **und** `user_id`. Niemand liest die Zeilen eines anderen, auch kein
-- Tenant-Admin. Die Politik wandert zusätzlich in `rls.sql` und
-- `rls-hardening.sql`, damit eine frische Datenbank denselben Stand bekommt.
--
-- Prisma könnte das ausdrücken; die Anweisungen laufen nur deshalb von Hand,
-- weil `prisma db push` gesperrt ist. Auf einer frischen Datenbank entsteht
-- derselbe Stand direkt aus `schema.prisma` — diese Datei ist das Protokoll des
-- Eingriffs, keine dauerhafte Voraussetzung.
--
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-20-view-preferences.sql
--
-- Angewandt am 2026-09-20 auf der Projektdatenbank.

BEGIN;

-- Spaltentypen **exakt so, wie Prisma sie aus `schema.prisma` erzeugen wuerde**
-- — abgelesen an `saved_portfolio_filters` und `role_onboarding`, nicht geraten:
-- `timestamp(3)` ohne Zeitzone, `created_at` mit CURRENT_TIMESTAMP, `updated_at`
-- ohne Default (Prisma setzt `@updatedAt` selbst), und **kein** DB-Default auf
-- `id` (die uuid kommt ebenfalls von Prisma). Ein `timestamptz` hier haette eine
-- frische Datenbank und diese hier dauerhaft auseinanderlaufen lassen.
CREATE TABLE IF NOT EXISTS view_preferences (
  id         uuid         NOT NULL PRIMARY KEY,
  tenant_id  uuid         NOT NULL,
  user_id    uuid         NOT NULL,
  key        text         NOT NULL,
  value      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL
);

-- Prismas `@@unique` erzeugt einen **Index**, keine Constraint — dieselbe Form
-- wie bei `saved_portfolio_filters` (siehe 2026-09-17).
CREATE UNIQUE INDEX IF NOT EXISTS view_preferences_tenant_id_user_id_key_key
  ON view_preferences (tenant_id, user_id, key);

CREATE INDEX IF NOT EXISTS view_preferences_tenant_id_user_id_idx
  ON view_preferences (tenant_id, user_id);

-- Tenant- UND user-isoliert, wörtlich nach dem Muster von `role_onboarding`.
ALTER TABLE view_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_user_isolation_view_preferences ON view_preferences;
CREATE POLICY tenant_user_isolation_view_preferences ON view_preferences
  FOR ALL
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
    AND user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

COMMIT;
