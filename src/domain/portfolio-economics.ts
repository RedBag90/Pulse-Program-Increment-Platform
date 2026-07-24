/**
 * Portfolio economics — pure, UTC, month-based. Turns each Epic's business-case
 * cost slices and benefits into monthly cost/benefit flows on a shared month
 * axis, then aggregates the active set into the dashboard series: benefit
 * velocity, costs, ROI, cumulative value/cost, net cash-flow and break-even.
 * No I/O. Mirrors the month-axis approach in `roadmap.ts`.
 *
 * Conventions (see the Portfolio Dashboard plan):
 * - A cost slice covers 6 months; its amount is spread evenly → amount/6 per month.
 * - Go-live = costStart + (#slices × 6 months); the one-time benefit lands there.
 * - Recurring benefit is annual → recurring/12 per month, from go-live to the
 *   horizon end (inclusive).
 */

import type { KpiMeasurement } from "@/domain/kpi";
import {
  monthStart,
  addMonths,
  monthDiff,
  parseHalfYearKey,
  buildMonthAxis,
  type MonthAxis,
} from "@/domain/calendar";
import { MONTHS_PER_HALF_YEAR, distributeAmountAcrossHalfYearMonths } from "@/domain/period-axis";
import { saturatedFulfillment } from "@/domain/kpi-direction";

export interface EpicEconomicsInput {
  id: string;
  title: string;
  /** 6-month cost slices; index 0 covers the first 6 months from costStart. */
  costSlices: number[];
  oneTimeBenefit: number;
  /** Annual recurring benefit at 100 % KPI fulfilment (spread /12 per month). */
  recurringBenefit: number;
  /** Calendar anchor: the month in which cost begins (Backlog milestone). */
  costStart: Date;
  /** Go-live / completion month (Implementation milestone) — see `resolveGoLive`. */
  goLive: Date;
  /**
   * Kumulierter realisierter KPI-Wert je Monat (length === monthCount, KPI-
   * Wertung). Vorhanden ⇒ die Benefit-Velocity folgt dem €-Zuwachs dieser Reihe
   * statt dem Business-Case-`recurringBenefit`. Absent ⇒ Flat-Forecast-Fallback.
   */
  kpiRealizedValueByMonth?: number[];
  /**
   * Per-month cost override (length === monthCount) — the participatory-budgeting
   * allocation. When present it replaces the cost-slice forecast entirely.
   */
  costByMonth?: number[];
}

export interface EpicMonthlyFlows {
  cost: number[];
  benefit: number[];
}

export interface EpicSeries extends EpicMonthlyFlows {
  id: string;
  title: string;
  net: number[];
  accCost: number[];
  accBenefit: number[];
  /** Cumulative net cash flow = accBenefit − accCost (per month, signed). */
  accNet: number[];
}

export interface PortfolioSeries {
  axis: MonthAxis;
  /** Per-Epic flows + cumulatives — the stacks for the stacked-bar panels. */
  perEpic: EpicSeries[];
  velocity: number[];
  costs: number[];
  net: number[];
  accBV: number[];
  accCost: number[];
  breakEven: number[];
  /** First month index where cumulative value covers cumulative cost, or null. */
  breakEvenIndex: number | null;
}

// The Backlog/Implementation anchor resolution (`resolveCostStart`,
// `resolveGoLive`) lives in `@/domain/epic-schedule` — economics consumes the
// already-resolved `costStart`/`goLive` on `EpicEconomicsInput`.

/** Derived go-live month (cost start + #slices × 6) — the `resolveGoLive` fallback. */
export function goLiveMonth(input: EpicEconomicsInput): Date {
  return addMonths(monthStart(input.costStart), input.costSlices.length * 6);
}

// --- flows -----------------------------------------------------------------

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

function cumulative(arr: number[]): number[] {
  const out = zeros(arr.length);
  let run = 0;
  for (let i = 0; i < arr.length; i++) {
    run += arr[i] ?? 0;
    out[i] = run;
  }
  return out;
}

// --- KPI-driven recurring benefit ------------------------------------------

/** One KPI's contribution to the recurring benefit (`weight` = fraction 0..1). */
export interface BenefitKpiInput {
  measurements: KpiMeasurement[];
  baseline: number | null;
  target: number | null;
  weight: number;
  /** €-Wert je Einheit (KPI-Wertung). */
  valuePerUnit: number | null;
}

/**
 * Per-month fulfilment of a KPI on the axis: the forward-filled measurement
 * (latest reading on or before each month) normalised over baseline→target.
 * Clamped below at 0 (no negatives) but **not** above — over-achievement
 * (> 1) is allowed. Months before the first measurement are 0.
 */
export function kpiFulfillmentByMonth(
  measurements: KpiMeasurement[],
  baseline: number | null,
  target: number | null,
  axis: MonthAxis,
): number[] {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const out = zeros(axis.monthCount);
  for (let i = 0; i < axis.monthCount; i++) {
    const monthEndMs = addMonths(axis.start, i + 1).getTime(); // exclusive
    let value: number | null = null;
    for (const m of sorted) {
      const t = Date.parse(m.date);
      if (Number.isNaN(t)) continue;
      if (t < monthEndMs)
        value = m.value; // forward-fill latest ≤ month
      else break; // ascending → remaining are later
    }
    out[i] = saturatedFulfillment(baseline, target, value);
  }
  return out;
}

/**
 * Per-month recurring-benefit factor = Σ weightₖ · fulfilmentₖ over the linked
 * KPIs. Returns null when no KPIs are linked, signalling the flat-forecast
 * fallback to `epicMonthlyFlows`.
 */
export function recurringFactorByMonth(kpis: BenefitKpiInput[], axis: MonthAxis): number[] | null {
  if (kpis.length === 0) return null;
  const out = zeros(axis.monthCount);
  for (const k of kpis) {
    const f = kpiFulfillmentByMonth(k.measurements, k.baseline, k.target, axis);
    for (let i = 0; i < axis.monthCount; i++) out[i] = (out[i] ?? 0) + k.weight * (f[i] ?? 0);
  }
  return out;
}

/**
 * **Kumulierter realisierter KPI-Wert je Monat** (KPI-Wertung) = Σ_kpi
 * fulfilment_kpi(m) × plannedₖ, mit `plannedₖ = |target−baseline| × valuePerUnit`.
 * fulfilment × planned = (Messwert−baseline) × valuePerUnit (wie das Epic-Tile,
 * ohne obere Kappung). `null`, wenn keine KPI mit `valuePerUnit` verknüpft ist
 * → Flat-Forecast-Fallback. Kein Contribution-`weight` (jede KPI trägt ihren
 * vollen €-Wert; anders als beim recurringBenefit-Split).
 */
export function kpiRealizedValueByMonth(kpis: BenefitKpiInput[], axis: MonthAxis): number[] | null {
  const valued = kpis.filter(
    (k) => (k.valuePerUnit ?? 0) !== 0 && k.baseline !== null && k.target !== null,
  );
  if (valued.length === 0) return null;
  const out = zeros(axis.monthCount);
  for (const k of valued) {
    const planned = Math.abs((k.target ?? 0) - (k.baseline ?? 0)) * (k.valuePerUnit ?? 0);
    if (planned === 0) continue;
    const f = kpiFulfillmentByMonth(k.measurements, k.baseline, k.target, axis);
    for (let i = 0; i < axis.monthCount; i++) out[i] = (out[i] ?? 0) + (f[i] ?? 0) * planned;
  }
  return out;
}

/**
 * Per-month cost from a participatory-budgeting allocation map (half-year key
 * "YYYY-H1|H2" → amount). Each half-year's amount is spread evenly across its
 * six months, placed on the axis. Months outside the axis are dropped.
 */
export function allocatedCostByMonth(
  allocatedByPeriod: Record<string, number>,
  axis: MonthAxis,
): number[] {
  const out = zeros(axis.monthCount);
  for (const [key, amount] of Object.entries(allocatedByPeriod)) {
    const periodStart = parseHalfYearKey(key);
    if (!periodStart) continue;
    const startIdx = monthDiff(axis.start, periodStart);
    distributeAmountAcrossHalfYearMonths(amount, startIdx, axis.monthCount, out);
  }
  return out;
}

/**
 * Maps the Epic's slices/benefits onto the axis as monthly cost/benefit flows.
 * The axis (Stichtag window) is the only cap — the recurring benefit accrues
 * from `benefitStart` through `axis.monthCount - 1`, so it keeps flowing for
 * as long as the chart's window does.
 */
export function epicMonthlyFlows(input: EpicEconomicsInput, axis: MonthAxis): EpicMonthlyFlows {
  const cost = zeros(axis.monthCount);
  const benefit = zeros(axis.monthCount);
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

  // Benefit-Velocity je Monat:
  //  - KPI-getrieben (`kpiRealizedValueByMonth` vorhanden): der in diesem Monat
  //    **realisierte** KPI-Wert = Zuwachs der kumulierten Realisierung
  //    (realized(m) − realized(m−1)). Die Kurve summiert so über die Zeit auf die
  //    volle KPI-Wertung; €-Wert entsteht nur bei einer KPI-Bewegung.
  //  - Flat-Forecast (keine KPI-Wertung): Business-Case-`recurringBenefit`/12 ab
  //    Go-live (cost start + #slices × 6 Monate).
  // Der one-time-Benefit ist ein Completion-Effekt und landet immer bei go-live.
  const goLiveIdx = monthDiff(axis.start, monthStart(input.goLive));
  const realized = input.kpiRealizedValueByMonth;
  if (realized) {
    let prev = 0;
    for (let idx = 0; idx < axis.monthCount; idx++) {
      const cum = realized[idx] ?? 0;
      benefit[idx] = (benefit[idx] ?? 0) + (cum - prev);
      prev = cum;
    }
  } else {
    const recPerMonth = input.recurringBenefit / 12;
    for (let idx = Math.max(0, goLiveIdx); idx < axis.monthCount; idx++) {
      benefit[idx] = (benefit[idx] ?? 0) + recPerMonth;
    }
  }
  if (goLiveIdx >= 0 && goLiveIdx < axis.monthCount) {
    benefit[goLiveIdx] = (benefit[goLiveIdx] ?? 0) + input.oneTimeBenefit;
  }

  return { cost, benefit };
}

/**
 * Aggregates the active Epics into the full set of dashboard series. The caller
 * has already applied the Projekt-ID slicer (which Epics) and chosen the axis
 * (the Stichtag window); this just sums and accumulates.
 */
export function aggregatePortfolio(inputs: EpicEconomicsInput[], axis: MonthAxis): PortfolioSeries {
  const n = axis.monthCount;
  const velocity = zeros(n);
  const costs = zeros(n);

  const perEpic: EpicSeries[] = inputs.map((input) => {
    const { cost, benefit } = epicMonthlyFlows(input, axis);
    const net = cost.map((c, i) => (benefit[i] ?? 0) - c);
    for (let i = 0; i < n; i++) {
      velocity[i] = (velocity[i] ?? 0) + (benefit[i] ?? 0);
      costs[i] = (costs[i] ?? 0) + (cost[i] ?? 0);
    }
    const accCost = cumulative(cost);
    const accBenefit = cumulative(benefit);
    return {
      id: input.id,
      title: input.title,
      cost,
      benefit,
      net,
      accCost,
      accBenefit,
      accNet: accBenefit.map((b, i) => b - (accCost[i] ?? 0)),
    };
  });

  const net = velocity.map((v, i) => v - (costs[i] ?? 0));
  const accBV = cumulative(velocity);
  const accCost = cumulative(costs);
  const breakEven = accBV.map((v, i) => v - (accCost[i] ?? 0));

  let breakEvenIndex: number | null = null;
  for (let i = 0; i < n; i++) {
    if ((accCost[i] ?? 0) > 0 && (breakEven[i] ?? 0) >= 0) {
      breakEvenIndex = i;
      break;
    }
  }

  return { axis, perEpic, velocity, costs, net, accBV, accCost, breakEven, breakEvenIndex };
}

// --- dashboard DTO + series montage ----------------------------------------
//
// The serialisable contract the dashboard loader returns and the assembly that
// turns it (plus the slicer window) into a `PortfolioSeries`. Pure, so it runs
// the same in the server loader and the client `useMemo`, and is tested at this
// seam rather than through the React component.

/** A KPI driving the recurring benefit, with its share and measurement history. */
export interface BenefitKpiDTO {
  kpiId: string;
  name: string;
  /** Share of the recurring benefit (fraction 0..1) — Legacy/Flat-Forecast. */
  weight: number;
  baseline: number | null;
  target: number | null;
  measurements: KpiMeasurement[];
  /** €-Wert je Einheit (KPI-Wertung — Quelle der Benefit-Velocity). */
  valuePerUnit: number | null;
}

/** One Epic's economics, serialisable (dates as ISO `yyyy-mm-dd`). */
export interface EpicEconomicsDTO {
  id: string;
  title: string;
  valueStream: string | null;
  costSlices: number[];
  oneTimeBenefit: number;
  recurringBenefit: number;
  /** Resolved cost-start month — Backlog milestone (ISO date). */
  costStartIso: string;
  /** Resolved go-live / completion month — Implementation milestone (ISO date). */
  goLiveIso: string;
  /** Whether the Epic carries any business-case content (else flows are 0). */
  hasBusinessCase: boolean;
  /**
   * Linked KPIs (with weights + history) that realise the recurring benefit.
   * Empty → the dashboard uses the flat-forecast fallback.
   */
  benefitKpis: BenefitKpiDTO[];
  /** True when a participatory-budgeting allocation exists → costs come from it. */
  hasAllocation: boolean;
  /** Allocated budget per half-year key (the budgeting decision). */
  allocatedByPeriod: Record<string, number>;
}

export interface PortfolioEconomicsData {
  epics: EpicEconomicsDTO[];
  /** Earliest cost start across all Epics (axis lower bound, ISO date). */
  axisFromIso: string;
  /** Configurable self-funding threshold per month, or null if unset. */
  costNeutralTarget: number | null;
  /** €/WSJF-Job-Size point — drives the €-axis of the PI-Planning capacity overlay. */
  costPerJobSizePoint: number | null;
}

/** The slicer state that narrows the DTO to a series: which Epics, which window. */
export interface PortfolioSeriesQuery {
  /** Epic ids to include (the Projekt-ID slicer). */
  selectedEpicIds: ReadonlySet<string>;
  /** Axis lower/upper bound — the Stichtag window (ISO `yyyy-mm-dd`). */
  fromIso: string;
  toIso: string;
}

const isoToDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** Maps one DTO Epic onto the axis, applying its KPI factor and cost override. */
function dtoToInput(e: EpicEconomicsDTO, axis: MonthAxis): EpicEconomicsInput {
  // KPI-Wertung treibt die Benefit-Velocity (€-Zuwachs über die Zeit); ohne
  // bewertete KPI → Flat-Forecast über den Business-Case-recurringBenefit.
  const realized = kpiRealizedValueByMonth(e.benefitKpis, axis);
  // A participatory-budgeting allocation drives the cost over the forecast slices.
  const costByMonth = e.hasAllocation ? allocatedCostByMonth(e.allocatedByPeriod, axis) : null;
  return {
    id: e.id,
    title: e.title,
    costSlices: e.costSlices,
    oneTimeBenefit: e.oneTimeBenefit,
    recurringBenefit: e.recurringBenefit,
    costStart: isoToDate(e.costStartIso),
    goLive: isoToDate(e.goLiveIso),
    ...(realized ? { kpiRealizedValueByMonth: realized } : {}),
    ...(costByMonth ? { costByMonth } : {}),
  };
}

/**
 * Assembles the full `PortfolioSeries` from the loader DTO and the slicer state.
 * The axis is the Stichtag window (`from`..`to`) and is the only cap on benefit
 * accrual — the recurring benefit flows for as long as the chosen window does.
 * Epics outside the selection are dropped before aggregation.
 */
export function buildPortfolioSeries(
  data: PortfolioEconomicsData,
  query: PortfolioSeriesQuery,
): PortfolioSeries {
  const axis = buildMonthAxis(isoToDate(query.fromIso), isoToDate(query.toIso));
  const inputs = data.epics
    .filter((e) => query.selectedEpicIds.has(e.id))
    .map((e) => dtoToInput(e, axis));
  return aggregatePortfolio(inputs, axis);
}
