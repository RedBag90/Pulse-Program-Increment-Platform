/**
 * Perioden-Karten-Primitive — die Rechnungen auf `Record<Halbjahres-Key, Betrag>`,
 * der Datenstruktur, auf der das ganze Modul rechnet (Topf, Epic-Allokation,
 * ART-Budget, Snapshot-Zellen).
 *
 * Vorher lebten diese vier Rechnungen verstreut: die Summe über eine Karte stand
 * ad-hoc in `epic-allocation.ts`, zweimal in `budget-plan-snapshot.ts` und in der
 * Revisions-View; „Verbleibend" existierte als `poolRemaining` (Topf − Σ Epics)
 * und `unassignedToArts` (VS-Budget − Σ ARTs) in zwei formgleichen Kopien.
 * Hier ist die Mathe **einmal** aufgeschrieben; die fachlichen Namen bleiben
 * dort, wo sie hingehören (siehe `budgeting.ts` / `art-budget.ts`).
 *
 * Rein, kein I/O, keine Uhr.
 */

/** Beträge je Halbjahres-Key, z. B. `{ "2026-H1": 120000 }`. */
export type PeriodAmounts = Record<string, number>;

/** Σ über alle Perioden einer Karte. */
export function sumPeriods(amounts: PeriodAmounts): number {
  let sum = 0;
  for (const value of Object.values(amounts)) sum += value;
  return sum;
}

/**
 * Addiert `amount` auf `target[key]` — mutiert die Zielkarte. Nullbeträge werden
 * verworfen, damit eine akkumulierte Karte keine Null-Zellen anlegt (die
 * Perioden-Raster leiten sich daraus ab: „Key vorhanden" heißt „hat Daten").
 */
export function addPeriod(target: PeriodAmounts, key: string, amount: number): void {
  if (amount === 0) return;
  target[key] = (target[key] ?? 0) + amount;
}

/**
 * Restbudget je Periode: `budget[key] − Σ children[*][key]`, für genau die
 * übergebenen `keys` (immer vollständig belegt, auch mit 0). Negativ bedeutet
 * Überverteilung — das ist erlaubt und wird von den Sichten rot markiert, nicht
 * als Fehler behandelt.
 */
export function remainingByPeriod(
  budget: PeriodAmounts,
  children: readonly PeriodAmounts[],
  keys: readonly string[],
): PeriodAmounts {
  const out: PeriodAmounts = {};
  for (const key of keys) {
    let allocated = 0;
    for (const child of children) allocated += child[key] ?? 0;
    out[key] = (budget[key] ?? 0) - allocated;
  }
  return out;
}
