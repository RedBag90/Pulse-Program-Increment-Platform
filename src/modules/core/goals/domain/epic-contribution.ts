/**
 * Rang-Logik fuer den Epic-Beitrag zu den Kopf-Zielen. Rein, kein I/O.
 *
 * Liegt bewusst hier und nicht in `server/views/epic-goal-contributions.ts`:
 * die Formel wird von der Server-Sortierung (`portfolio-overview.ts`) **und**
 * vom Client-Umschalter (`goal-contribution-block.tsx`) gebraucht. Im
 * Server-View haengt sie am Prisma-Import — der Client wuerde ihn mitziehen.
 */

/** Welcher der beiden Werte eines Beitrags gilt — Plan oder Ist. */
export type ContributionMode = "planned" | "realized";

/** Strukturelle Sicht auf einen Beitragswert (erfuellt von `UnitValue`). */
export interface ContributionValue {
  planned: number;
  realized: number;
}

/**
 * Rang-Summe eines Epic-Beitrags: Σ ueber alle Einheiten von wiederkehrend +
 * einmalig. Bewusst einheitenblind — Kopf-Ziele koennen verschiedene Einheiten
 * tragen; fuers Ranking wird der Mix in Kauf genommen, die Anzeige bleibt je
 * Einheit getrennt.
 */
export function totalContribution(
  c: {
    recurring: readonly ContributionValue[];
    oneTime: readonly ContributionValue[];
  },
  mode: ContributionMode,
): number {
  let sum = 0;
  for (const v of c.recurring) sum += v[mode];
  for (const v of c.oneTime) sum += v[mode];
  return sum;
}

/** Wie sich der realisierte Nutzen zum geplanten verhaelt. */
export type BenefitPerformance = "over" | "on" | "under";

/**
 * **Uebertrifft ein Epic seinen Plan, oder bleibt es darunter?**
 *
 * `null`, wenn kein Plan vorliegt (Plan ≤ 0): ohne Bezugsgroesse gibt es keine
 * Abweichung, und `realized / 0` waere eine erfundene Zahl. `"on"` meldet die
 * Funktion nur bei **exakter** Gleichheit — jede echte Abweichung bekommt ihr
 * Vorzeichen.
 *
 * **Die Funktion sagt nicht, ob der Vergleich fair ist.** `realized` waechst
 * ueber die Zeit; ein Epic mitten in der Umsetzung hat den Plan noch gar nicht
 * erreichen koennen. Wer hier vergleichen darf, entscheidet der Aufrufer — in
 * der Portfolio-Uebersicht erst ab L4.2, wenn die Umsetzung fertig gemeldet
 * ist. Ohne diese Trennung stuende bei fast allen 140 Zeilen dasselbe Zeichen.
 *
 * Rein, kein I/O.
 */
export function benefitPerformance(input: {
  planned: number;
  realized: number;
}): { state: BenefitPerformance; delta: number } | null {
  if (input.planned <= 0) return null;
  const delta = input.realized / input.planned - 1;
  // **Kein Totband.** Es gab eines von fuenf Prozent, und es lag an der denkbar
  // schlechtesten Stelle: der Datensatz setzt das Ist durchweg auf 95 % des
  // Plans, also genau auf die Grenze. Ob eine Zeile „wie geplant" oder „−5 %"
  // sagte, entschied damit allein die Rundung auf Tausender. Eine Abweichung ist
  // eine Abweichung; wie gross sie sein muss, um zu zaehlen, entscheidet die
  // Leserin an der Prozentzahl.
  if (delta === 0) return { state: "on", delta };
  return { state: delta > 0 ? "over" : "under", delta };
}
