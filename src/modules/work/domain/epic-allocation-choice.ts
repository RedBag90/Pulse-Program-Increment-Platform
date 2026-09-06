/**
 * **Ein Euro, ein Topf.** Aus welcher Zuteilung die Kosten eines Epics kommen.
 *
 * Ein Epic ist entweder ein **ART-Epic** oder ein **Portfolio-Epic**, und daher
 * kommen auch seine Kosten. Es gibt dafür zwei getrennte Tabellen:
 *
 *  - `BudgetAllocation` — die Zuteilung des Wertstroms an Portfolio-Epics,
 *    als Halbjahres-Karte im JSON.
 *  - `ArtEpicAllocation` — die Verteilung des ART-Topfs an seine ART-Epics,
 *    je Zeile ein Halbjahr.
 *
 * Beide Formen liegen in den Daten, und sie sehen verschieden aus:
 *
 * ```
 * Large Test Corp   17 ART-Zuteilungen · Betrag IDENTISCH mit dem Portfolio-Topf
 *                   → derselbe Euro, in zwei Tabellen gespiegelt
 * Pulse Demo Corp    4 ART-Zuteilungen · Portfolio-Topf im selben Zyklus LEER
 *                   → 40–100 T€, die sonst verschwiegen würden
 * ```
 *
 * Zu addieren wäre in Large Test Corp eine glatte Verdopplung; nur den
 * Portfolio-Topf zu lesen verlöre in Pulse Demo Corp 292 T€. Deshalb **wählt**
 * die Klasse den Topf — und ein leerer Topf tritt zurück, damit eine noch
 * vorläufige Einordnung kein reales Geld verschluckt.
 *
 * Die Regel gehört zu **Work**, nicht zu Budgeting: sie sagt etwas über das
 * Epic — welcher Art es ist und woher daher sein Geld kommt. Budgeting darf sie
 * lesen (ADR-0013: `Work ← Budgeting`), umgekehrt nicht.
 *
 * Rein, kein I/O.
 */

/** Die Einordnung des Epics; `null` = (noch) keine. */
export type EpicClassLike = "portfolio" | "art" | null;

export interface AllocationChoice {
  portfolio: number;
  art: number;
  epicClass: EpicClassLike;
}

/**
 * Der Betrag **eines** Zyklus. **Nie eine Summe** der beiden Töpfe.
 *
 * Die Klasse wählt; ist ihr Topf leer, gilt der andere. Ohne Klasse zählt, was
 * da ist — Geld verschwindet nicht, weil eine Einordnung noch aussteht.
 */
export function chooseAllocation(input: AllocationChoice): number {
  const { portfolio, art, epicClass } = input;
  if (epicClass === "art") return art !== 0 ? art : portfolio;
  if (epicClass === "portfolio") return portfolio !== 0 ? portfolio : art;
  return portfolio !== 0 ? portfolio : art;
}

/**
 * Dieselbe Wahl über **alle** Zyklen beider Karten. Der Schlüssel ist das
 * Halbjahr (`"YYYY-H1" | "YYYY-H2"`); Zyklen ohne Geld fallen weg, damit
 * „welche Zyklen tragen etwas" eine Frage an die Schlüssel bleibt.
 */
export function chooseAllocations(
  portfolio: Readonly<Record<string, number>>,
  art: Readonly<Record<string, number>>,
  epicClass: EpicClassLike,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cycleKey of new Set([...Object.keys(portfolio), ...Object.keys(art)])) {
    const amount = chooseAllocation({
      portfolio: portfolio[cycleKey] ?? 0,
      art: art[cycleKey] ?? 0,
      epicClass,
    });
    if (amount !== 0) out[cycleKey] = amount;
  }
  return out;
}
