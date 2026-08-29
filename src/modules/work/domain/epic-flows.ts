/**
 * Geteilter **Ökonomie-Kern je Epic** — die eine Quelle der Wahrheit für die
 * Kosten-/Benefit-/Forecast-Flüsse eines Epics auf einer gegebenen Monatsachse.
 * Sowohl das Portfolio-Dashboard (aggregiert monatlich über das Portfolio) als
 * auch der Epic-Tab „Business case calculation" (unterteilt die Monatswahrheit
 * tagesweise) rufen `epicFlows` auf, damit beide **nie divergieren**.
 *
 * Modell:
 *  - Kosten: eine Monats-Override aus der partizipativen Budgetierung
 *    (`costByMonth`, „freigegeben") gewinnt; sonst („veranschlagt") fällt die
 *    Business-Case-Investition (Σ `costSlices`) **taggenau gewichtet** im
 *    Umsetzungsfenster **L4.1 → L4.2** an (`[implementationStart,
 *    implementationEndExclusive)`) — dort passiert die Umsetzung und dort
 *    entstehen die Kosten. Monatswert = Σ × Fenstertage-im-Monat ÷ Fenstertage.
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

import {
  monthStart,
  monthDiff,
  addMonths,
  daysBetween,
  type MonthAxis,
} from "@/modules/core/kernel/domain/calendar";
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
  const goLiveIdx = monthDiff(axis.start, monthStart(input.goLive));

  // Costs: a per-month allocation override (participatory budgeting) wins.
  // Otherwise the whole business-case investment (Σ costSlices) accrues in the
  // day-precise implementation window L4.1 → L4.2, weighted by each month's
  // share of the window days — that is where the delivery work happens.
  if (input.costByMonth) {
    for (let i = 0; i < axis.monthCount; i++) cost[i] = input.costByMonth[i] ?? 0;
  } else {
    const total = input.costSlices.reduce((sum, amount) => sum + (amount ?? 0), 0);
    if (total !== 0) {
      // Fallback ohne Fensterfelder (direkte Aufrufer): costStart-Monat …
      // goLive-Monat (exklusiv), mindestens 1 Tag.
      const winStart = input.implementationStart ?? monthStart(input.costStart);
      let winEnd = input.implementationEndExclusive ?? monthStart(input.goLive);
      if (winEnd.getTime() <= winStart.getTime()) {
        winEnd = new Date(winStart.getTime() + 24 * 60 * 60 * 1000);
      }
      const windowDays = daysBetween(winStart, winEnd);
      const firstIdx = Math.max(0, monthDiff(axis.start, monthStart(winStart)));
      const lastIdx = Math.min(axis.monthCount - 1, monthDiff(axis.start, monthStart(winEnd)));
      for (let idx = firstIdx; idx <= lastIdx; idx++) {
        const ms = addMonths(axis.start, idx);
        const me = addMonths(axis.start, idx + 1);
        const from = ms.getTime() > winStart.getTime() ? ms : winStart;
        const to = me.getTime() < winEnd.getTime() ? me : winEnd;
        const overlap = daysBetween(from, to);
        if (overlap > 0) cost[idx] = (cost[idx] ?? 0) + (total * overlap) / windowDays;
      }
    }
  }

  // Benefit-Velocity je Monat — die beiden Nutzen-Arten getrennt (benefitKind):
  //  one-time: KPI-Realisierungs-Zuwachs, sonst Business-Case-Spike am Go-Live.
  //  recurring: laufende KPI-Run-Rate, sonst Business-Case-`recurringBenefit`/12.
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
