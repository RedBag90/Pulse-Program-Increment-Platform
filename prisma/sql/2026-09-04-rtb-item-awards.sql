-- Die Aufteilung des Wertstrom-Zuspruchs auf seine Positionen.
--
-- Von Hand zu fahren (`prisma db execute --file …`), nicht über `db push`:
-- die Alt-Migration (`epic_approvals`, `approval_phase`, `approval_revision`)
-- ist weiterhin offen, und ein `db push` würde sie mitreißen.
--
-- **Rein additiv.** Die Tabelle entsteht leer; solange nichts darin steht,
-- meldet `loadArtPot` einen Rahmen von 0 €. Das Backfill-Skript
-- (`prisma/scripts/2026-09-04-rtb-award-backfill.ts`) füllt sie aus den
-- bestehenden Kandidaten-Endbeträgen, damit die Töpfe über den Umbau hinweg
-- dieselben Zahlen zeigen. Erst danach ist die Anwendung wieder vollständig.

CREATE TABLE IF NOT EXISTS rtb_item_awards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants (id),
  rtb_item_id uuid NOT NULL REFERENCES run_the_business_items (id) ON DELETE CASCADE,
  -- Halbjahr, "YYYY-H1" | "YYYY-H2" — dieselbe Achse wie `art_epic_allocations`.
  cycle_key   text NOT NULL,
  amount      numeric(14, 2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid NOT NULL
);

-- Eine Position hat je Halbjahr genau einen Zuspruch. Der Schreibpfad rechnet
-- den Deckel in derselben Transaktion; ohne diesen Index könnten zwei
-- gleichzeitige Aufteilungen zwei Zeilen erzeugen und der Deckel liefe leer.
CREATE UNIQUE INDEX IF NOT EXISTS rtb_item_awards_item_cycle_key
  ON rtb_item_awards (rtb_item_id, cycle_key);

CREATE INDEX IF NOT EXISTS rtb_item_awards_tenant_cycle_idx
  ON rtb_item_awards (tenant_id, cycle_key);
