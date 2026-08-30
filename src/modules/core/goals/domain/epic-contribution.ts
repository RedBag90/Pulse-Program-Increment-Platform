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
