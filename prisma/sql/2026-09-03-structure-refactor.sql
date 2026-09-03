-- Struktur-Refactoring — drei Spalten in einem Zug.
--
-- Von Hand zu fahren (`prisma db execute --file …`), nicht über `db push`:
-- die Alt-Migration (`epic_approvals`, `approval_phase`, `approval_revision`)
-- ist weiterhin offen, und ein `db push` würde sie mitreißen.
--
-- Reihenfolge: die additiven Spalten zuerst, das Löschen zuletzt — so bleibt
-- ein abgebrochener Lauf in einem Zustand, in dem die Anwendung läuft.

-- 1 · Produkt-Manager einer Solution. Freies Personenfeld ohne Fremdschlüssel,
--     wie `value_streams.finance_approver_id` und `arts.rte_id`.
ALTER TABLE solutions
  ADD COLUMN IF NOT EXISTS product_manager_id uuid;

-- 2 · Erwartete Einordnung eines Epics ("portfolio" | "art").
--     Nullable: Bestands-Epics tragen keine Erwartung, und eine erfundene wäre
--     schlimmer als keine. Pflicht ist der Anlege-Weg, nicht die Spalte.
ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS intended_class text;

-- 3 · Die PI-Kadenz am ART entfällt. Der Takt entsteht am PI-Standard, der die
--     Program Increments einer Timeline bildet; der ART tritt einer Timeline
--     bei. Diese Spalte hat nie etwas berechnet — sie wurde nur angezeigt und
--     gepflegt, und konnte der echten Kadenz widersprechen.
--
--     NICHT zu verwechseln mit `target_operating_models.target_pi_cadence_weeks`
--     (die Soll-Kadenz des Zielbilds) — die bleibt.
ALTER TABLE arts
  DROP COLUMN IF EXISTS pi_cadence_weeks;
