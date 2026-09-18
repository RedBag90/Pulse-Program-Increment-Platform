-- `solutions.art_id` wird Pflicht.
--
-- Der Grund steht in `docs/concepts/art-budget-consolidation.md` §1.7 und §3:
-- Betriebsgeld wird künftig auf ARTs aufgelöst, und einer der drei Wege dorthin
-- führt über die Solution. Eine Solution ohne ART bricht diesen Weg — die
-- Position bleibt dann sichtbar „nicht zugeordnet", statt still geschlüsselt zu
-- werden (`rtb-art-resolution.ts`, Fall `solutionWithoutArt`).
--
-- **Gemessen, was die Pflicht wirklich bewegt:** von 25 aktiven
-- Betriebspositionen lösen sich 24 schon heute auf. Die eine, die es nicht tut,
-- trägt 7.500 € je Halbjahr. Das ist der ganze Gewinn dieser Spalte — der
-- Einwand dazu steht als Zitat in §3 der Spec und bleibt gültig; die
-- Entscheidung ist trotzdem gefallen.
--
-- ADR-0020 (Lebenszyklus beginnt in H2) und ADR-0022 (Solution ist Struktur,
-- hängt am Wertstrom) bekommen je einen Nachtrag: ab hier braucht auch eine
-- „Emerging"-Solution von Anfang an ein ART.
--
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/sql/2026-09-19-solution-art-required.sql
--
-- Läuft in **einer** Transaktion: entweder sind alle sieben Zeilen gefüllt und
-- die Spalte ist Pflicht, oder es hat sich nichts geändert.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · Nachpflege der sieben ART-losen Solutions
-- ---------------------------------------------------------------------------
--
-- Jede Zeile löst über Mandant **und** Name auf — Namen wiederholen sich
-- zwischen Mandanten. Die Herkunft steht dabei: **abgeleitet** heißt, das ART
-- ergibt sich eindeutig aus den Epics dieser Solution; **entschieden** heißt,
-- es gab keinen eindeutigen Kandidaten und jemand hat gewählt. Wer das in einem
-- Jahr liest, soll die beiden nicht verwechseln.

-- abgeleitet: 29 Epics dieser Solution liegen in „Warehouse & Inventory"
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Large Test Corp'
   AND s.name = 'Logistik Programm'
   AND a.name = 'Warehouse & Inventory'
   AND s.art_id IS NULL;

-- abgeleitet: 30 Epics in „Plant Efficiency (OEE)"
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Large Test Corp'
   AND s.name = 'Produktion Programm'
   AND a.name = 'Plant Efficiency (OEE)'
   AND s.art_id IS NULL;

-- entschieden: keine Epics, also kein Hinweis aus den Daten
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Large Test Corp'
   AND s.name = 'Verwaltung & Overhead Programm'
   AND a.name = 'Shared Services & Automation'
   AND s.art_id IS NULL;

-- abgeleitet: 2 Epics in „Web & Mobile"
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Pulse Demo Corp'
   AND s.name = 'Customer Experience MVP'
   AND a.name = 'Web & Mobile'
   AND s.art_id IS NULL;

-- abgeleitet: 1 Epic in „Cards & Wallets"
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Pulse Demo Corp'
   AND s.name = 'Payments Platform MVP'
   AND a.name = 'Cards & Wallets'
   AND s.art_id IS NULL;

-- entschieden: die Epics standen 3:2 für „Accounts & Onboarding"
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Pulse Demo Corp'
   AND s.name = 'Digital Banking MVP'
   AND a.name = 'Accounts & Onboarding'
   AND s.art_id IS NULL;

-- entschieden: h0, keine Epics
UPDATE solutions s SET art_id = a.id
  FROM arts a, tenants t
 WHERE s.tenant_id = t.id AND a.tenant_id = t.id
   AND t.name = 'Pulse Demo Corp'
   AND s.name = 'Digital Banking Legacy'
   AND a.name = 'Accounts & Onboarding'
   AND s.art_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2 · Gegenprobe, bevor die Spalte zumacht
-- ---------------------------------------------------------------------------
--
-- `SET NOT NULL` würde ohnehin scheitern, wenn etwas offen bliebe — aber mit
-- einer Meldung über die Spalte, nicht über die Zeile. Hier steht, **welche**
-- Solution fehlt; das ist beim Nachpflegen der Unterschied zwischen einer
-- Minute und einer Viertelstunde.

DO $$
DECLARE offen int; namen text;
BEGIN
  SELECT count(*), string_agg(t.name || ' / ' || s.name, ', ')
    INTO offen, namen
    FROM solutions s JOIN tenants t ON t.id = s.tenant_id
   WHERE s.art_id IS NULL;
  IF offen > 0 THEN
    RAISE EXCEPTION 'Abbruch: % Solution(s) ohne ART — %', offen, namen;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3 · Die Spalte wird Pflicht
-- ---------------------------------------------------------------------------
--
-- Die Fremdschlüssel-Regel bleibt `ON DELETE SET NULL` — und das wäre ab jetzt
-- ein Widerspruch: ein gelöschtes ART setzte `art_id` auf NULL und verletzte
-- die Bedingung im selben Atemzug. Deshalb wird sie auf `RESTRICT` gezogen: ein
-- ART, an dem eine Solution hängt, lässt sich nicht mehr hart löschen. Das
-- übliche Löschen im Haus ist ohnehin weich (`deleted_at`).

ALTER TABLE solutions ALTER COLUMN art_id SET NOT NULL;

ALTER TABLE solutions DROP CONSTRAINT IF EXISTS solutions_art_id_fkey;
ALTER TABLE solutions
  ADD CONSTRAINT solutions_art_id_fkey
  FOREIGN KEY (art_id) REFERENCES arts(id) ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
