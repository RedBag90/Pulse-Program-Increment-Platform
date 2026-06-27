/**
 * PeriodAxis — kanonische Konvertierung zwischen `HalfYearAxis` (Budgeting)
 * und `MonthAxis` (Portfolio Economics).
 *
 * Heute wurde die "halbjaehrlicher Betrag wird gleichmaessig auf seine 6
 * Monate verteilt"-Regel an zwei Stellen inline gerechnet: in
 * `allocatedCostByMonth` (per-Period-Allocation-Map) und in der
 * `costSlices`-Branch von `epicMonthlyFlows` (Index-basiert). Hier wohnt der
 * Kernel; off-by-one wuerde an einer Stelle gefixt, statt an zwei.
 *
 * Die zwei Achsen bleiben absichtlich getrennt (siehe CONTEXT.md `MonthAxis`
 * vs `HalfYearAxis`); dieses Modul ist nur die Bruecke.
 */

export const MONTHS_PER_HALF_YEAR = 6;

/**
 * Verteilt `amount` gleichmaessig auf die sechs Monatsslots eines
 * Half-Year-Periods. `halfYearStartIdx` ist der Monatsindex auf der
 * `MonthAxis`, an dem der Period beginnt; `axisMonthCount` die Achsenlaenge.
 * Slots ausserhalb [0, axisMonthCount) fallen weg.
 *
 * Schreibt additiv in `out`, sodass mehrere Periods auf dieselbe Achse
 * akkumulieren koennen (Standard-Pattern bei `Record<halfYearKey, amount>`).
 */
export function distributeAmountAcrossHalfYearMonths(
  amount: number,
  halfYearStartIdx: number,
  axisMonthCount: number,
  out: number[],
): void {
  if (!amount) return;
  const perMonth = amount / MONTHS_PER_HALF_YEAR;
  for (let k = 0; k < MONTHS_PER_HALF_YEAR; k++) {
    const idx = halfYearStartIdx + k;
    if (idx >= 0 && idx < axisMonthCount) out[idx] = (out[idx] ?? 0) + perMonth;
  }
}
