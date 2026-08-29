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

import type { KpiMeasurement } from "@/modules/core/kpi/domain/kpi";
import {
  monthStart,
  addMonths,
  monthDiff,
  parseHalfYearKey,
  buildMonthAxis,
  type MonthAxis,
} from "@/modules/core/kernel/domain/calendar";
import { distributeAmountAcrossHalfYearMonths } from "@/modules/core/kernel/domain/period-axis";
import { saturatedFulfillment } from "@/modules/core/kpi/domain/kpi-direction";
import { benefitKindOrDefault } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { recurringIntervalOrDefault } from "@/modules/core/kpi/domain/kpi-recurring-interval";
import { stageAtMonth, type StageTransition } from "@/modules/work/domain/epic-stage-timeline";
import { epicFlows } from "./epic-flows";

const STAGE_ORDER = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;

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
   * Kumulierter realisierter Wert der **one-time**-KPIs je Monat (length ===
   * monthCount). Vorhanden ⇒ der Einmal-Benefit folgt dem €-Zuwachs dieser Reihe
   * (Realisierung über die Zeit) statt dem Business-Case-`oneTimeBenefit`-Spike.
   */
  kpiRealizedValueByMonth?: number[];
  /**
   * Laufende **recurring**-KPI-Run-Rate je Monat (length === monthCount): der in
   * diesem Monat wirksame wiederkehrende Nutzen (annual/12 × fulfilment).
   * Vorhanden ⇒ ersetzt den Business-Case-`recurringBenefit`/12-Fallback.
   */
  kpiRecurringByMonth?: number[];
  /**
   * Per-month cost override (length === monthCount) — the participatory-budgeting
   * allocation. When present it replaces the cost-slice forecast entirely.
   */
  costByMonth?: number[];
  /**
   * Voller monatlicher Recurring-Run-Rate-Betrag bei 100 % Zielerreichung (Σ über
   * bewertete recurring-KPIs). Treibt den **Forecast-„Rest zum Ziel"**: in
   * Zukunftsmonaten (≥ go-live) das Delta `atFull − gemessene Run-Rate`. `undefined`
   * ⇒ kein KPI-Rest (Business-Case-Fallback ist bereits der Plan).
   */
  kpiRecurringAtFull?: number;
  /**
   * Funding-Konfidenz: `true` ⇒ eine partizipative Budget-Allocation existiert
   * (freigegebenes Budget), `false`/`undefined` ⇒ Business-Case-Schätzung
   * (veranschlagt). Nur ein Marker; die Kosten selbst treibt `costByMonth`.
   */
  hasAllocation?: boolean;
}

export interface EpicMonthlyFlows {
  cost: number[];
  /** Gemessener/realisierter Benefit je Monat (KPI-Messung bzw. BC-Fallback). */
  benefit: number[];
  /**
   * Forecast-„Rest zum Ziel": zusätzlicher Benefit in **Zukunftsmonaten** (> heute,
   * ≥ go-live), der die gemessene Fortschreibung auf den geplanten KPI-Mehrwert @Ziel
   * anhebt. Ist-Monate = 0. Gesamt-Benefit = `benefit + benefitUplift`.
   */
  benefitUplift: number[];
}

export interface EpicSeries extends EpicMonthlyFlows {
  id: string;
  title: string;
  net: number[];
  accCost: number[];
  /** Kumulierter **Gesamt**-Benefit (benefit + benefitUplift). */
  accBenefit: number[];
  /** Cumulative net cash flow = accBenefit − accCost (per month, signed). */
  accNet: number[];
  /**
   * Funding-Konfidenz je Epic: freigegebenes Budget (true) vs. veranschlagt
   * (false). Treibt den solid/hatched-Split der Kosten-Stacks. Für aggregierte
   * Gruppen-Serien `undefined` (dort steckt die Klassifikation in der Sub-Serie).
   */
  hasAllocation?: boolean;
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
  /** Achsen-Index des aktuellen Monats („heute"); Monate > todayIndex = Forecast.
   *  −1, falls heute vor dem Achsenstart liegt. */
  todayIndex: number;
}

/**
 * Fasst die Epic-Serien zu **Value-Stream-Gruppen** zusammen — je Value Stream
 * **nach Funding-Konfidenz gesplittet**: eine `vs:<name>`-Serie für die
 * freigegebenen Epics (solid) und eine `vs:<name>:est`-Serie für die
 * veranschlagten (schraffiert), analog zum `:est`-Muster von
 * `groupSeriesByEstimatedStage`. So klassifiziert die Value-Stream-Sicht das
 * Funding **je Epic** (wie Epic-/Status-Sicht) statt „ein unfinanziertes Epic
 * schraffiert den ganzen Wertstrom". `hasAllocation` je Epic-Serie steuert den
 * Split; `vsNameByEpicId` liefert den VS-Namen (`null` ⇒ `unassignedLabel`).
 * Reihenfolge: VS-Name aufsteigend, je Name freigegeben vor veranschlagt, der
 * Unassigned-Bucket zuletzt. Alle Serien teilen dieselbe Achsenlänge.
 */
export function groupSeriesByValueStream(
  perEpic: readonly EpicSeries[],
  vsNameByEpicId: ReadonlyMap<string, string | null>,
  unassignedLabel = "Ohne Wertstrom",
): EpicSeries[] {
  const UNASSIGNED_KEY = "￿"; // sortiert nach allen echten Namen ⇒ zuletzt
  const groups = new Map<string, EpicSeries>();
  const meta = new Map<string, { sortName: string; confirmed: boolean }>();
  for (const e of perEpic) {
    const name = vsNameByEpicId.get(e.id) ?? null;
    const confirmed = e.hasAllocation ?? false;
    const sortName = name ?? UNASSIGNED_KEY;
    const key = `${sortName}|${confirmed ? "c" : "e"}`;
    let g = groups.get(key);
    if (!g) {
      const baseId = name != null ? `vs:${name}` : "vs:__none__";
      g = {
        id: confirmed ? baseId : `${baseId}:est`,
        title: name ?? unassignedLabel,
        cost: [],
        benefit: [],
        benefitUplift: [],
        net: [],
        accCost: [],
        accBenefit: [],
        accNet: [],
      };
      groups.set(key, g);
      meta.set(key, { sortName, confirmed });
    }
    addInto(g.cost, e.cost);
    addInto(g.benefit, e.benefit);
    addInto(g.benefitUplift, e.benefitUplift);
    addInto(g.net, e.net);
    addInto(g.accCost, e.accCost);
    addInto(g.accBenefit, e.accBenefit);
    addInto(g.accNet, e.accNet);
  }
  // VS-Name aufsteigend; je Name freigegeben (solid) vor veranschlagt (est).
  return [...groups.keys()]
    .sort((a, b) => {
      const ma = meta.get(a)!;
      const mb = meta.get(b)!;
      if (ma.sortName !== mb.sortName) return ma.sortName < mb.sortName ? -1 : 1;
      return (ma.confirmed ? 0 : 1) - (mb.confirmed ? 0 : 1);
    })
    .map((k) => groups.get(k)!);
}

/** Element-weise Summe: addiert `src` in `dst` (verlängert `dst` bei Bedarf). */
function addInto(dst: number[], src: readonly number[]): void {
  for (let i = 0; i < src.length; i++) dst[i] = (dst[i] ?? 0) + (src[i] ?? 0);
}

/**
 * Fasst die Epic-Serien **nach Reifegrad-Status (Stage-Gate L0–L5)** zusammen —
 * **zeit-variabel**: je Monat zählt der Fluss eines Epics zu dem Status, in dem es
 * in diesem Monat gerade ist (Actual rückwärts / Estimate vorwärts, s.
 * `stageAtMonth`). Anschließend werden die Bucket-Kumulierten neu gerechnet (nicht
 * die Epic-Kumulierten summiert). Der freigegeben/veranschlagt-Split (`confirmedById`)
 * bleibt als eigene Sub-Serie (`status:<gate>:est`) erhalten.
 */
export function groupSeriesByEstimatedStage(
  perEpic: readonly EpicSeries[],
  stageTimelineById: ReadonlyMap<string, StageTransition[]>,
  axis: MonthAxis,
  confirmedById: ReadonlyMap<string, boolean>,
): EpicSeries[] {
  const n = axis.monthCount;
  interface Bucket {
    gate: string;
    confirmed: boolean;
    cost: number[];
    benefit: number[];
    benefitUplift: number[];
  }
  const buckets = new Map<string, Bucket>();
  for (const e of perEpic) {
    const tl = stageTimelineById.get(e.id) ?? [];
    const confirmed = confirmedById.get(e.id) ?? false;
    for (let m = 0; m < n; m++) {
      const gate = stageAtMonth(tl, addMonths(axis.start, m));
      const key = `${gate}|${confirmed ? "c" : "e"}`;
      let b = buckets.get(key);
      if (!b) {
        b = { gate, confirmed, cost: zeros(n), benefit: zeros(n), benefitUplift: zeros(n) };
        buckets.set(key, b);
      }
      b.cost[m] = (b.cost[m] ?? 0) + (e.cost[m] ?? 0);
      b.benefit[m] = (b.benefit[m] ?? 0) + (e.benefit[m] ?? 0);
      b.benefitUplift[m] = (b.benefitUplift[m] ?? 0) + (e.benefitUplift[m] ?? 0);
    }
  }
  const rank = (b: Bucket): number =>
    STAGE_ORDER.indexOf(b.gate as (typeof STAGE_ORDER)[number]) * 2 + (b.confirmed ? 0 : 1);
  return [...buckets.values()]
    .sort((a, b) => rank(a) - rank(b))
    .map((b) => {
      const total = b.benefit.map((x, i) => x + (b.benefitUplift[i] ?? 0));
      const accCost = cumulative(b.cost);
      const accBenefit = cumulative(total);
      return {
        id: b.confirmed ? `status:${b.gate}` : `status:${b.gate}:est`,
        title: b.gate,
        cost: b.cost,
        benefit: b.benefit,
        benefitUplift: b.benefitUplift,
        net: b.cost.map((c, i) => (total[i] ?? 0) - c),
        accCost,
        accBenefit,
        accNet: accBenefit.map((x, i) => x - (accCost[i] ?? 0)),
      };
    });
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
  /** Benefit-Art: "one_time" | "recurring" — bestimmt Einmal- vs. Run-Rate-Reihe. */
  benefitKind: string;
  /** Bei recurring: "monthly" | "yearly" — skaliert die Run-Rate (×1 bzw. ÷12). */
  recurringInterval: string;
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

/** Bewertete KPI (valuePerUnit gesetzt, baseline/target vorhanden) der gegebenen Art. */
function valuedKpisOfKind(
  kpis: BenefitKpiInput[],
  kind: "one_time" | "recurring",
): BenefitKpiInput[] {
  return kpis.filter(
    (k) =>
      benefitKindOrDefault(k.benefitKind) === kind &&
      (k.valuePerUnit ?? 0) !== 0 &&
      k.baseline !== null &&
      k.target !== null,
  );
}

/**
 * **Kumulierter realisierter Wert der one-time-KPIs je Monat** (KPI-Wertung) =
 * Σ_kpi fulfilment_kpi(m) × plannedₖ, mit `plannedₖ = |target−baseline| ×
 * valuePerUnit`. fulfilment × planned = (Messwert−baseline) × valuePerUnit (wie
 * das Epic-Tile, ohne obere Kappung). Der Monats-Zuwachs dieser Reihe = der in
 * dem Monat realisierte Einmal-Benefit; über die Zeit summiert er auf den vollen
 * KPI-Wert. `null`, wenn keine bewertete **one-time**-KPI verknüpft ist →
 * Business-Case-`oneTimeBenefit`-Spike als Fallback. Kein Contribution-`weight`.
 */
export function kpiRealizedValueByMonth(kpis: BenefitKpiInput[], axis: MonthAxis): number[] | null {
  const valued = valuedKpisOfKind(kpis, "one_time");
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
 * **Laufende Run-Rate der recurring-KPIs je Monat** (KPI-Wertung): jede recurring-
 * KPI liefert bei voller Zielerreichung einen Perioden-Wert `periodValue =
 * |target−baseline| × valuePerUnit`. Je nach `recurringInterval` ist das ein
 * **monatlicher** (`monthly` → direkt je Monat) oder **jährlicher** (`yearly` →
 * periodValue/12 je Monat) Betrag; pro Monat wirksam `monthlyAtFull × fulfilment(m)`.
 * Anders als die one-time-Reihe ist das keine einmalige Realisierung, sondern ein
 * fortlaufender Monatsbetrag, der mit der KPI-Erfüllung mitatmet. `null`, wenn
 * keine bewertete **recurring**-KPI verknüpft ist → Business-Case-
 * `recurringBenefit`/12-Fallback.
 */
export function kpiRecurringByMonth(kpis: BenefitKpiInput[], axis: MonthAxis): number[] | null {
  const valued = valuedKpisOfKind(kpis, "recurring");
  if (valued.length === 0) return null;
  const out = zeros(axis.monthCount);
  for (const k of valued) {
    const periodValue = Math.abs((k.target ?? 0) - (k.baseline ?? 0)) * (k.valuePerUnit ?? 0);
    if (periodValue === 0) continue;
    const monthlyAtFull =
      recurringIntervalOrDefault(k.recurringInterval) === "monthly"
        ? periodValue
        : periodValue / 12;
    const f = kpiFulfillmentByMonth(k.measurements, k.baseline, k.target, axis);
    for (let i = 0; i < axis.monthCount; i++) out[i] = (out[i] ?? 0) + monthlyAtFull * (f[i] ?? 0);
  }
  return out;
}

/**
 * Σ des vollen monatlichen Run-Rate-Betrags über alle bewerteten recurring-KPIs
 * (bei 100 % Zielerreichung). Basis des Forecast-„Rest zum Ziel".
 */
export function kpiRecurringAtFullTotal(kpis: BenefitKpiInput[]): number {
  let sum = 0;
  for (const k of valuedKpisOfKind(kpis, "recurring")) {
    const periodValue = Math.abs((k.target ?? 0) - (k.baseline ?? 0)) * (k.valuePerUnit ?? 0);
    if (periodValue === 0) continue;
    sum +=
      recurringIntervalOrDefault(k.recurringInterval) === "monthly"
        ? periodValue
        : periodValue / 12;
  }
  return sum;
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
 * Thin wrapper over the shared per-Epic core `epicFlows` (`./epic-flows`) — the
 * single source of truth shared with the Epic „Business case calculation"-Tab.
 * The funding flag is irrelevant here (the aggregator stamps it separately), so
 * it is passed as `false` and the `hasAllocation` result dropped.
 */
export function epicMonthlyFlows(
  input: EpicEconomicsInput,
  axis: MonthAxis,
  todayIndex: number,
): EpicMonthlyFlows {
  const { cost, benefit, benefitUplift } = epicFlows(
    { ...input, hasAllocation: input.hasAllocation ?? false },
    axis,
    todayIndex,
  );
  return { cost, benefit, benefitUplift };
}

/**
 * Aggregates the active Epics into the full set of dashboard series. The caller
 * has already applied the Projekt-ID slicer (which Epics) and chosen the axis
 * (the Stichtag window); this just sums and accumulates.
 */
export function aggregatePortfolio(
  inputs: EpicEconomicsInput[],
  axis: MonthAxis,
  todayIndex: number,
): PortfolioSeries {
  const n = axis.monthCount;
  const velocity = zeros(n);
  const costs = zeros(n);

  const perEpic: EpicSeries[] = inputs.map((input) => {
    const { cost, benefit, benefitUplift, hasAllocation } = epicFlows(
      { ...input, hasAllocation: input.hasAllocation ?? false },
      axis,
      todayIndex,
    );
    // Gesamt-Benefit (gemessen + Forecast-Rest) treibt Netto/Kumulierte/Velocity.
    const total = benefit.map((b, i) => b + (benefitUplift[i] ?? 0));
    const net = cost.map((c, i) => (total[i] ?? 0) - c);
    for (let i = 0; i < n; i++) {
      velocity[i] = (velocity[i] ?? 0) + (total[i] ?? 0);
      costs[i] = (costs[i] ?? 0) + (cost[i] ?? 0);
    }
    const accCost = cumulative(cost);
    const accBenefit = cumulative(total);
    return {
      id: input.id,
      title: input.title,
      cost,
      benefit,
      benefitUplift,
      net,
      accCost,
      accBenefit,
      accNet: accBenefit.map((b, i) => b - (accCost[i] ?? 0)),
      hasAllocation,
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

  return {
    axis,
    perEpic,
    velocity,
    costs,
    net,
    accBV,
    accCost,
    breakEven,
    breakEvenIndex,
    todayIndex,
  };
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
  /** Benefit-Art: "one_time" | "recurring" — partitioniert Einmal vs. Run-Rate. */
  benefitKind: string;
  /** Bei recurring: "monthly" | "yearly" — Intervall des Run-Rate-Werts. */
  recurringInterval: string;
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
  /** Effektive Stage-Übergänge (Actual ?? Estimate) — treibt die „Nach Status"-Gruppierung. */
  stageTimeline: { gate: string; iso: string }[];
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
  // KPI-Wertung treibt die Benefit-Velocity (€ über die Zeit), nach Art getrennt:
  // one-time-KPIs → Realisierungs-Zuwachs, recurring-KPIs → laufende Run-Rate.
  // Ohne bewertete KPI der jeweiligen Art → Business-Case-Fallback (Spike bzw. flat).
  const realized = kpiRealizedValueByMonth(e.benefitKpis, axis);
  const recurring = kpiRecurringByMonth(e.benefitKpis, axis);
  const recurringAtFull = kpiRecurringAtFullTotal(e.benefitKpis);
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
    hasAllocation: e.hasAllocation,
    ...(realized ? { kpiRealizedValueByMonth: realized } : {}),
    ...(recurring ? { kpiRecurringByMonth: recurring } : {}),
    ...(recurringAtFull > 0 ? { kpiRecurringAtFull: recurringAtFull } : {}),
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
  now: Date,
): PortfolioSeries {
  const axis = buildMonthAxis(isoToDate(query.fromIso), isoToDate(query.toIso));
  // „heute"-Grenze: Monate ≤ todayIndex = Ist, danach = Forecast. −1, falls
  // heute vor Achsenstart liegt (dann ist alles Forecast).
  const todayIndex = monthDiff(axis.start, monthStart(now));
  const inputs = data.epics
    .filter((e) => query.selectedEpicIds.has(e.id))
    .map((e) => dtoToInput(e, axis));
  return aggregatePortfolio(inputs, axis, todayIndex);
}
