/**
 * Reserve — der Rest, der sich nicht mehr sinnvoll verteilen lässt (D-03/F-03).
 *
 * Das Budget wird so weit wie möglich verteilt; ein Rest **unterhalb des
 * günstigsten Epics** kann kein Vorhaben mehr finanzieren und geht als Reserve
 * in die Folgerunde. Die Reserve wird nicht unterjährig frei vergeben.
 *
 * Rein, kein I/O.
 */

export interface ReserveResult {
  /** Verbleibendes Budget (verteilbar − finanziert). */
  reserve: number;
  /** True, wenn der Rest kein Epic mehr finanzieren kann (Rest < günstigstes). */
  fullyDistributed: boolean;
}

/**
 * Reserve = `available − allocated`. „Vollständig verteilt", sobald der Rest
 * unter dem günstigsten (noch nicht finanzierten) Epic liegt. `cheapestCost`
 * ≤ 0 bedeutet „kein finanzierbares Epic mehr offen" → immer vollständig verteilt.
 */
export function computeReserve(
  available: number,
  allocated: number,
  cheapestCost: number,
): ReserveResult {
  const reserve = available - allocated;
  const fullyDistributed = cheapestCost <= 0 || reserve < cheapestCost;
  return { reserve, fullyDistributed };
}

/**
 * Trägt die Reserve additiv in den Topf der Folgerunde. Bewusst nur der Betrag —
 * vertagte Epics kommen manuell via Prüfauftrag zurück.
 */
export function carryReserveForward(nextPool: number, reserve: number): number {
  return nextPool + Math.max(0, reserve);
}
