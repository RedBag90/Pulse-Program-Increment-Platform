/**
 * Business-Case-Kalkulation eines Epics auf **Tagesbasis** — die tagesgenaue
 * Entsprechung der (intern monatlichen) Portfolio-Ökonomie. Für jeden Tag von
 * L0-Start bis Horizont: Reifegrad, Kostenverteilung (€/Tag), Benefit Velocity
 * (€/Tag) und die kumulierten Werte inkl. Break-even.
 *
 * Modell (aus `portfolio-economics.ts` / `epic-stage-timeline.ts` abgeleitet):
 *  - Reifegrad = letzte Transition ≤ Tag (effektives Datum je Phase = Actual ??
 *    Estimate). Robust gegen ein in der Zukunft liegendes `createdAt` (Seed-
 *    Artefakt): L0-Start = frühestes aller Datumswerte.
 *  - Kosten = `BudgetAllocation`-Halbjahr (gewinnt) bzw. `costSlices` gleichmäßig
 *    über die Kalendertage der Periode verteilt.
 *  - Benefit (recurring) = Jahreswert ÷ 365 × Fulfillment (KPI-Messung forward-
 *    filled); ab „heute" Vollrate (Forecast/Uplift). One-time = Increment des
 *    realisierten Werts.
 *
 * Pure, kein I/O.
 */

import {
  isoDay,
  parseIsoDay,
  dayStart,
  addDays,
  addMonths,
  daysBetween,
  monthStart,
  monthDiff,
  buildMonthAxis,
} from "@/modules/core/kernel/domain/calendar";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { parseTimeline, type TimelineEstimatePhase } from "@/modules/work/domain/timeline";
import {
  deriveEpicEconomics,
  type EpicEconomicsKpiInput,
} from "@/modules/work/domain/epic-economics";
import { epicFlows } from "@/modules/work/domain/epic-flows";
import {
  allocatedCostByMonth,
  kpiRealizedValueByMonth,
  kpiRecurringByMonth,
  kpiRecurringAtFullTotal,
  type EpicEconomicsInput,
} from "@/modules/work/domain/portfolio-economics";

/** Eingaben je Epic (serverseitig aus dem Epic-Detail-Model befüllt). */
export interface BcCalcInput {
  createdAt: Date;
  selectedForDetailingAt: Date | null;
  hypothesisApprovedAt: Date | null;
  selectedForAnalyzingAt: Date | null;
  businessCaseApprovedAt: Date | null;
  implementationStartedAt: Date | null;
  impactRecognizedAt: Date | null;
  plannedEndAt: Date | null;
  /** Rohes `timeline`-JSON (Estimates/Actuals). */
  timeline: unknown;
  /** Rohes `businessCase`-JSON. */
  businessCase: unknown;
  /** Halbjahres-€-Map der BudgetAllocation (gewinnt vor costSlices). */
  allocatedByPeriod: Record<string, number>;
  /** Alle KPIs des Epics (für Benefit-Velocity). */
  kpis: EpicEconomicsKpiInput[];
  /** „Heute" — Ist/Forecast-Grenze. */
  now: Date;
}

/** Eine Tageszeile der Kalkulation. */
export interface BcCalcDay {
  day: string; // ISO yyyy-mm-dd
  gate: StageGate;
  costPerDay: number;
  benefitPerDay: number;
  cumBenefit: number;
  cumCost: number;
  net: number;
  isForecast: boolean;
}

export interface BcCalcSummary {
  costStart: string;
  goLive: string;
  breakEvenDay: string | null;
  totalCost: number;
  recurringAnnualAtTarget: number;
  oneTimeAtTarget: number;
  /** Jahres-Benefit @Ziel ÷ Gesamt-Investition × 100, oder null. */
  roiPct: number | null;
  firstDay: string;
  lastDay: string;
  /**
   * Funding-Konfidenz: `true` ⇒ freigegebenes Budget (BudgetAllocation liegt vor,
   * treibt die Kosten), `false` ⇒ veranschlagt (Business-Case-`costSlices`).
   * Dieselbe Klassifikation wie die solid/schraffiert-Kosten im Dashboard.
   */
  hasAllocation: boolean;
}

export interface BcCalcResult {
  rows: BcCalcDay[];
  summary: BcCalcSummary;
}

const PHASE_GATE: { gate: StageGate; estimate: TimelineEstimatePhase }[] = [
  { gate: "L1", estimate: "detailing" },
  { gate: "L1", estimate: "hypothesis" },
  { gate: "L2", estimate: "analyzing" },
  { gate: "L2", estimate: "business_case" },
  { gate: "L3", estimate: "backlog" },
  { gate: "L4", estimate: "implementation_started" },
  { gate: "L4", estimate: "implementation" },
  { gate: "L5", estimate: "done" },
];

const isoOrNull = (d: Date | null): string | null => (d ? isoDay(d) : null);
const maxDate = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

export function buildEpicBusinessCaseCalc(input: BcCalcInput): BcCalcResult {
  const eco = deriveEpicEconomics({
    businessCase: input.businessCase,
    timeline: input.timeline,
    businessCaseApprovedAt: input.businessCaseApprovedAt,
    hypothesisApprovedAt: input.hypothesisApprovedAt,
    createdAt: input.createdAt,
    kpis: input.kpis,
  });
  const tl = parseTimeline(input.timeline);

  // ── Reifegrad-Transitionen (tagesgenau) ─────────────────────────────────
  const actualByPhase: Partial<Record<TimelineEstimatePhase, string | null>> = {
    detailing: isoOrNull(input.selectedForDetailingAt),
    hypothesis: isoOrNull(input.hypothesisApprovedAt),
    analyzing: isoOrNull(input.selectedForAnalyzingAt),
    business_case: isoOrNull(input.businessCaseApprovedAt),
    backlog: tl.actuals.backlog ?? null,
    implementation_started: isoOrNull(input.implementationStartedAt),
    implementation: tl.actuals.implementation ?? null,
    done: isoOrNull(input.impactRecognizedAt),
  };
  const phaseTransitions: { gate: StageGate; day: Date }[] = [];
  for (const p of PHASE_GATE) {
    const iso = actualByPhase[p.estimate] ?? tl.estimates[p.estimate] ?? null;
    if (iso) phaseTransitions.push({ gate: p.gate, day: parseIsoDay(iso) });
  }
  // L0-Start = frühestes Datum (schützt vor createdAt in der Zukunft).
  let axisStart = dayStart(input.createdAt);
  for (const t of phaseTransitions) if (t.day.getTime() < axisStart.getTime()) axisStart = t.day;
  const transitions = [{ gate: "L0" as StageGate, day: axisStart }, ...phaseTransitions].sort(
    (a, b) => a.day.getTime() - b.day.getTime(),
  );
  const stageAtDay = (day: Date): StageGate => {
    let gate: StageGate = "L0";
    for (const t of transitions) {
      if (t.day.getTime() <= day.getTime()) gate = t.gate;
      else break;
    }
    return gate;
  };

  // ── Horizont (Go-Live / plannedEnd / letzte Messung / heute + 18 M, gekappt) ─
  const nowDay = dayStart(input.now);
  let lastMeas = axisStart;
  for (const k of eco.benefitKpis) {
    for (const m of k.measurements) {
      const t = parseIsoDay(m.date);
      if (t.getTime() > lastMeas.getTime()) lastMeas = t;
    }
  }
  let end = eco.goLive;
  if (input.plannedEndAt) end = maxDate(end, dayStart(input.plannedEndAt));
  end = maxDate(end, lastMeas);
  end = maxDate(end, nowDay);
  end = addMonths(end, 18);
  const cap = addMonths(axisStart, 72); // max. 6 Jahre
  if (end.getTime() > cap.getTime()) end = cap;

  // ── Monatswahrheit aus dem geteilten Kern (`epicFlows`); Tage = Unterteilung ─
  // Exakt dieselben Monatswerte wie das Portfolio-Dashboard (eine Quelle der
  // Wahrheit). Die Tageswerte verteilen den Monatsbetrag gleichmäßig über die
  // Kalendertage des Monats (Σ Tage eines Monats = Monatswert).
  const axis = buildMonthAxis(axisStart, end);
  const todayIndex = monthDiff(axis.start, monthStart(nowDay));
  const allocEntries = Object.entries(input.allocatedByPeriod);
  const hasAllocation = allocEntries.length > 0;
  const realized = kpiRealizedValueByMonth(eco.benefitKpis, axis);
  const recurring = kpiRecurringByMonth(eco.benefitKpis, axis);
  const recurringAtFull = kpiRecurringAtFullTotal(eco.benefitKpis);
  const flowsInput: EpicEconomicsInput & { hasAllocation: boolean } = {
    id: "",
    title: "",
    costSlices: eco.costSlices,
    oneTimeBenefit: eco.oneTimeBenefit,
    recurringBenefit: eco.recurringBenefit,
    costStart: eco.costStart,
    goLive: eco.goLive,
    hasAllocation,
    ...(hasAllocation ? { costByMonth: allocatedCostByMonth(input.allocatedByPeriod, axis) } : {}),
    ...(realized ? { kpiRealizedValueByMonth: realized } : {}),
    ...(recurring ? { kpiRecurringByMonth: recurring } : {}),
    ...(recurringAtFull > 0 ? { kpiRecurringAtFull: recurringAtFull } : {}),
  };
  const flows = epicFlows(flowsInput, axis, todayIndex);
  const daysInMonth = (idx: number): number => {
    const ms = addMonths(axis.start, idx);
    return daysBetween(ms, addMonths(ms, 1));
  };

  // ── Tagesschleife: Monatsbetrag ÷ Kalendertage des jeweiligen Monats ─────
  const rows: BcCalcDay[] = [];
  let cumBenefit = 0;
  let cumCost = 0;
  let breakEvenDay: string | null = null;
  for (let d = axisStart; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const mIdx = monthDiff(axis.start, monthStart(d));
    const dim = daysInMonth(mIdx);
    const cost = (flows.cost[mIdx] ?? 0) / dim;
    const benefit = ((flows.benefit[mIdx] ?? 0) + (flows.benefitUplift[mIdx] ?? 0)) / dim;
    const isForecast = mIdx > todayIndex;
    cumBenefit += benefit;
    cumCost += cost;
    if (breakEvenDay === null && cumCost > 0 && cumBenefit >= cumCost) breakEvenDay = isoDay(d);
    rows.push({
      day: isoDay(d),
      gate: stageAtDay(d),
      costPerDay: cost,
      benefitPerDay: benefit,
      cumBenefit,
      cumCost,
      net: cumBenefit - cumCost,
      isForecast,
    });
  }

  const totalCost = cumCost;
  const summary: BcCalcSummary = {
    costStart: isoDay(eco.costStart),
    goLive: isoDay(eco.goLive),
    breakEvenDay,
    totalCost,
    recurringAnnualAtTarget: eco.recurringBenefit,
    oneTimeAtTarget: eco.oneTimeBenefit,
    roiPct: totalCost > 0 ? (eco.recurringBenefit / totalCost) * 100 : null,
    firstDay: rows[0]?.day ?? isoDay(axisStart),
    lastDay: rows[rows.length - 1]?.day ?? isoDay(end),
    hasAllocation,
  };
  return { rows, summary };
}
