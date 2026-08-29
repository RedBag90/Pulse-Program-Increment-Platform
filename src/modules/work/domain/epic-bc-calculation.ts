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
  parseHalfYearKey,
} from "@/modules/core/kernel/domain/calendar";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { parseTimeline, type TimelineEstimatePhase } from "@/modules/work/domain/timeline";
import {
  deriveEpicEconomics,
  type EpicEconomicsKpiInput,
} from "@/modules/work/domain/epic-economics";
import { kpiPlanned, kpiPlannedAtTarget } from "@/modules/core/kpi/domain/kpi-valuation";
import { saturatedFulfillment } from "@/modules/core/kpi/domain/kpi-direction";

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

  // ── Kosten je Tag (Allocation gewinnt vor costSlices) ───────────────────
  const costByDay = new Map<number, number>();
  const spread = (start: Date, endExclusive: Date, amount: number): void => {
    const days = daysBetween(start, endExclusive);
    if (days <= 0 || !amount) return;
    const per = amount / days;
    for (let i = 0; i < days; i++) {
      const key = addDays(start, i).getTime();
      costByDay.set(key, (costByDay.get(key) ?? 0) + per);
    }
  };
  const allocEntries = Object.entries(input.allocatedByPeriod);
  if (allocEntries.length > 0) {
    for (const [key, amount] of allocEntries) {
      const s = parseHalfYearKey(key);
      if (s) spread(s, addMonths(s, 6), amount);
    }
  } else {
    eco.costSlices.forEach((amount, i) => {
      const s = addMonths(eco.costStart, 6 * i);
      spread(s, addMonths(s, 6), amount);
    });
  }

  // ── Benefit je Tag (recurring: Run-Rate × Fulfillment; one-time: Increment) ─
  const kpiState = eco.benefitKpis.map((k) => ({
    k,
    ms: k.measurements
      .map((m) => ({ t: parseIsoDay(m.date).getTime(), v: m.value }))
      .sort((a, b) => a.t - b.t),
    idx: 0,
    lastVal: null as number | null,
    oneTimeRealized: 0,
    dailyFull: kpiPlanned(k) / 365,
    oneTimeTotal:
      kpiPlannedAtTarget({
        baseline: k.baseline,
        target: k.target,
        valuePerUnit: k.valuePerUnit,
      }) ?? 0,
  }));

  // ── Horizont ────────────────────────────────────────────────────────────
  const nowDay = dayStart(input.now);
  let lastMeas = axisStart;
  for (const s of kpiState) {
    const last = s.ms[s.ms.length - 1];
    if (last) lastMeas = maxDate(lastMeas, new Date(last.t));
  }
  let end = eco.goLive;
  if (input.plannedEndAt) end = maxDate(end, dayStart(input.plannedEndAt));
  end = maxDate(end, lastMeas);
  end = maxDate(end, nowDay);
  end = addMonths(end, 18);
  const cap = addMonths(axisStart, 72); // max. 6 Jahre
  if (end.getTime() > cap.getTime()) end = cap;

  // ── Tagesschleife ───────────────────────────────────────────────────────
  const rows: BcCalcDay[] = [];
  let cumBenefit = 0;
  let cumCost = 0;
  let breakEvenDay: string | null = null;
  for (let d = axisStart; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const isForecast = d.getTime() > nowDay.getTime();
    const cost = costByDay.get(d.getTime()) ?? 0;
    let benefit = 0;
    for (const s of kpiState) {
      while (s.idx < s.ms.length && s.ms[s.idx]!.t <= d.getTime()) {
        s.lastVal = s.ms[s.idx]!.v;
        s.idx += 1;
      }
      const fulfil = saturatedFulfillment(s.k.baseline, s.k.target, s.lastVal);
      if (s.k.benefitKind === "one_time") {
        const realized = Math.min(1, fulfil) * s.oneTimeTotal;
        const inc = Math.max(0, realized - s.oneTimeRealized);
        s.oneTimeRealized = realized;
        benefit += inc;
      } else {
        benefit += isForecast ? s.dailyFull : s.dailyFull * fulfil;
      }
    }
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
  };
  return { rows, summary };
}
