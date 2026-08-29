/**
 * Geteilter **Ökonomie-Kern je Epic** — die eine Quelle der Wahrheit für die
 * Kosten-/Benefit-/Forecast-Flüsse eines Epics auf einer gegebenen Monatsachse.
 * Sowohl das Portfolio-Dashboard (aggregiert monatlich über das Portfolio) als
 * auch der Epic-Tab „Business case calculation" (unterteilt die Monatswahrheit
 * tagesweise) rufen `epicFlows` auf, damit beide **nie divergieren**.
 *
 * Modell (unverändert aus dem bisherigen `epicMonthlyFlows`):
 *  - Kosten: eine Monats-Override aus der partizipativen Budgetierung
 *    (`costByMonth`, „freigegeben") gewinnt über die gleichmäßig verteilten
 *    6-Monats-`costSlices` („veranschlagt").
 *  - Benefit (gemessen): one-time = Zuwachs der realisierten KPI-Wertung bzw.
 *    Business-Case-Spike am Go-Live; recurring = laufende KPI-Run-Rate bzw.
 *    `recurringBenefit`/12 ab Go-Live.
 *  - Forecast-„Rest zum Ziel" (`benefitUplift`): nur in Zukunftsmonaten
 *    (> heute, ≥ Go-Live) das Delta `atFull − gemessene Run-Rate`.
 *  - `hasAllocation`: Funding-Konfidenz — freigegeben (true) vs. veranschlagt
 *    (false). Wird durchgereicht, damit beide Konsumenten dieselbe Klassifikation
 *    zeigen können.
 *
 * Pure, kein I/O.
 */

import { monthStart, monthDiff, type MonthAxis } from "@/modules/core/kernel/domain/calendar";
import {
  MONTHS_PER_HALF_YEAR,
  distributeAmountAcrossHalfYearMonths,
} from "@/modules/core/kernel/domain/period-axis";
import type { EpicEconomicsInput, EpicMonthlyFlows } from "./portfolio-economics";

export interface EpicFlowsResult extends EpicMonthlyFlows {
  /** Funding-Konfidenz: freigegebenes Budget (true) vs. veranschlagt (false). */
  hasAllocation: boolean;
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/**
 * Bildet die Slices/Benefits eines Epics auf die (gegebene) Monatsachse als
 * monatliche Kosten-/Benefit-Flüsse ab. Die Achse (Stichtag-Fenster bzw.
 * Epic-Fenster) ist die einzige Kappung — der recurring Benefit fließt so lange,
 * wie das Fenster reicht. Identisch zum bisherigen `epicMonthlyFlows`, zusätzlich
 * gibt es `hasAllocation` unverändert zurück.
 */
export function epicFlows(
  input: EpicEconomicsInput & { hasAllocation: boolean },
  axis: MonthAxis,
  todayIndex: number,
): EpicFlowsResult {
  const cost = zeros(axis.monthCount);
  const benefit = zeros(axis.monthCount);
  const benefitUplift = zeros(axis.monthCount);
  const startIdx = monthDiff(axis.start, monthStart(input.costStart));

  // Costs: a per-month allocation override (participatory budgeting) wins over the
  // cost-slice forecast; otherwise each 6-month slice is spread evenly.
  if (input.costByMonth) {
    for (let i = 0; i < axis.monthCount; i++) cost[i] = input.costByMonth[i] ?? 0;
  } else {
    input.costSlices.forEach((amount, s) => {
      distributeAmountAcrossHalfYearMonths(
        amount ?? 0,
        startIdx + s * MONTHS_PER_HALF_YEAR,
        axis.monthCount,
        cost,
      );
    });
  }

  // Benefit-Velocity je Monat — die beiden Nutzen-Arten getrennt (benefitKind):
  //  one-time: KPI-Realisierungs-Zuwachs, sonst Business-Case-Spike am Go-Live.
  //  recurring: laufende KPI-Run-Rate, sonst Business-Case-`recurringBenefit`/12.
  const goLiveIdx = monthDiff(axis.start, monthStart(input.goLive));

  const oneTime = input.kpiRealizedValueByMonth;
  if (oneTime) {
    let prev = 0;
    for (let idx = 0; idx < axis.monthCount; idx++) {
      const cum = oneTime[idx] ?? 0;
      benefit[idx] = (benefit[idx] ?? 0) + (cum - prev);
      prev = cum;
    }
  } else if (goLiveIdx >= 0 && goLiveIdx < axis.monthCount) {
    benefit[goLiveIdx] = (benefit[goLiveIdx] ?? 0) + input.oneTimeBenefit;
  }

  const recurring = input.kpiRecurringByMonth;
  if (recurring) {
    for (let idx = 0; idx < axis.monthCount; idx++) {
      benefit[idx] = (benefit[idx] ?? 0) + (recurring[idx] ?? 0);
    }
  } else {
    const recPerMonth = input.recurringBenefit / 12;
    for (let idx = Math.max(0, goLiveIdx); idx < axis.monthCount; idx++) {
      benefit[idx] = (benefit[idx] ?? 0) + recPerMonth;
    }
  }

  // Forecast-„Rest zum Ziel": nur für KPI-getriebene recurring-KPIs, in
  // Zukunftsmonaten (> heute, ≥ go-live) das Delta zur vollen Run-Rate @Ziel.
  const atFull = input.kpiRecurringAtFull;
  if (recurring && atFull != null && atFull > 0) {
    const from = Math.max(goLiveIdx, todayIndex + 1, 0);
    for (let idx = from; idx < axis.monthCount; idx++) {
      const gap = atFull - (recurring[idx] ?? 0);
      benefitUplift[idx] = gap > 0 ? gap : 0;
    }
  }

  return { cost, benefit, benefitUplift, hasAllocation: input.hasAllocation };
}
