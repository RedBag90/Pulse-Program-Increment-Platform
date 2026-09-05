/**
 * Die **Form** des ART-Epic-Budgets — was ein ART für ein Halbjahr hat.
 *
 * Sie steht hier und nicht beim Lader, weil sie nichts vom Laden weiß: Flächen,
 * Falter und Regeln sprechen über diese Form, ohne Prisma zu kennen.
 * `server/services/art-epic-budget.ts` beantwortet, **wie** man an sie kommt,
 * und reicht den Typ weiter, damit vorhandene Aufrufer nichts merken.
 *
 * Bis September 2026 gab es die Form zweimal: hier und als `ArtPot` — dieselben
 * Felder ohne `artId`, verbunden durch eine Funktion, die nur Felder abschrieb.
 * Der Löschtest war eindeutig, also ist sie weg.
 *
 * Rein, kein I/O.
 */

export interface ArtEpicBudget {
  artId: string;
  cycleKey: string;
  /** Zugesprochen: Σ der Awards auf den aktiven ART-Epic-Budget-Positionen. */
  total: number;
  /** Verteilt: Σ der Zuteilungen an die Epics dieses ARTs. */
  distributed: number;
  /** Rest — verfällt nicht und wandert nicht; er wird ausgewiesen. */
  remaining: number;
  /** Warum gerade nicht verteilt werden darf; `null` = offen. */
  closedReason: string | null;
}
