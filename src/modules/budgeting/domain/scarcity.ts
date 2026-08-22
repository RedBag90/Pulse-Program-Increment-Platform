/**
 * Knappheitsfaktor — das Qualitätstor vor der PB-Runde (A-06).
 *
 * Übersteigt die Gesamtnachfrage (Σ Kosten-bis-MVP aller Ballot-Epics) das
 * verteilbare Budget nicht deutlich, gibt es keinen echten Trade-off — die
 * Runde entfällt und wird zentral entschieden. Schwelle: Faktor ≥ 1,3.
 *
 * Rein, kein I/O.
 */

/** Mindest-Knappheitsfaktor, ab dem eine Runde einen echten Trade-off hat. */
export const MIN_SCARCITY_FACTOR = 1.3;

/**
 * Nachfrage / verteilbares Budget. Ein Pool ≤ 0 ist unendlich knapp
 * (`Infinity`) — jede positive Nachfrage kann nicht gedeckt werden.
 */
export function scarcityFactor(demand: number, pool: number): number {
  if (pool <= 0) return demand > 0 ? Infinity : 0;
  return demand / pool;
}

/** True, wenn die Runde einen echten Trade-off hat (Faktor ≥ Schwelle). */
export function passesScarcityGate(factor: number, min: number = MIN_SCARCITY_FACTOR): boolean {
  return factor >= min;
}
