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
 *  - Kosten = `BudgetAllocation`-Halbjahr (gewinnt; Monatswert ÷ Kalendertage)
 *    bzw. veranschlagt: die BC-Investition (Σ `costSlices`) taggenau im
 *    Umsetzungsfenster L4.1 → L4.2 (Σ ÷ Fenstertage an Fenstertagen, sonst 0).
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
  /**
   * `"month"` laesst die Tageszeilen weg (Default `"day"`, damit vorhandene
   * Aufrufer unveraendert bleiben). Die Rechnung selbst laeuft immer taggenau —
   * gekappt wird nur, was den Client erreicht.
   */
  granularity?: "day" | "month";
}

/**
 * Eine **Monatszeile** — die Ebene, mit der die Fläche startet.
 *
 * Bis September 2026 reiste ausschliesslich die Tagesebene ins RSC-Payload:
 * fuer ein laufendes Epic rund 1 675 Zeilen und 239 KB JSON, obwohl die
 * Tabelle zugeklappt oeffnet und beim ersten Rendern keine einzige davon
 * zeigt. Monate sind hoechstens 72 — die Tage kommen beim Aufklappen nach.
 */
export interface BcCalcMonth {
  /** `yyyy-mm`. */
  month: string;
  gateFrom: StageGate;
  gateTo: StageGate;
  cost: number;
  benefit: number;
  cumBenefit: number;
  cumCost: number;
  net: number;
  isForecast: boolean;
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
  /** Erster Tag mit Kosten (effektiver Kostenbeginn; Fallback: Backlog-Monat). */
  costStart: string;
  goLive: string;
  breakEvenDay: string | null;
  /**
   * **Zugeteilt** — die Kosten, welche die Kurve tatsaechlich traegt. Liegt eine
   * `BudgetAllocation` vor, folgt sie ihr; sonst den Kostenscheiben. Das ist
   * nicht zwingend `estimatedCost`: sobald ein Budget alloziert ist, koennen
   * die beiden auseinandergehen — deshalb stehen sie nebeneinander statt als
   * eine Zahl namens „Investition".
   */
  totalCost: number;
  /** **Veranschlagt** — Σ der Kostenscheiben aus dem Business Case. */
  estimatedCost: number;
  recurringAnnualAtTarget: number;
  oneTimeAtTarget: number;
  /**
   * Jahres-Nutzen @Ziel ÷ zugeteilte Kosten × 100, oder null.
   *
   * **Kein ROI**: bei Break-even steht hier 100 %, nicht 0 %. Ein ROI waere
   * `(Nutzen − Kosten) / Kosten`. Der Name sagt jetzt, was die Zahl ist.
   */
  benefitCostRatioPct: number | null;
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
  /**
   * Tageszeilen — **leer**, wenn `granularity: "month"` angefordert wurde.
   * Dann liefert `loadBcCalcDays` sie fuer genau den aufgeklappten Monat nach.
   */
  rows: BcCalcDay[];
  /** Immer gefuellt: die Monatsebene, aus der Tabelle und Kurve entstehen. */
  months: BcCalcMonth[];
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
    implementationStartedAt: input.implementationStartedAt,
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
  // Wahrheit). Benefit-Tageswerte verteilen den Monatsbetrag gleichmäßig über
  // die Kalendertage; veranschlagte Kosten liegen taggenau im Umsetzungsfenster
  // (Σ Tage eines Monats = Monatswert des Kerns, in beiden Fällen).
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
    implementationStart: eco.implementationWindow.start,
    implementationEndExclusive: eco.implementationWindow.endExclusive,
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
  // Veranschlagt: Kosten/Tag = Σ Investition ÷ Fenstertage, nur an Fenstertagen.
  const totalInvest = eco.costSlices.reduce((sum, amount) => sum + (amount ?? 0), 0);
  const win = eco.implementationWindow;
  const windowDays = daysBetween(win.start, win.endExclusive);
  const estimatedCostAt = (d: Date): number =>
    totalInvest !== 0 &&
    d.getTime() >= win.start.getTime() &&
    d.getTime() < win.endExclusive.getTime()
      ? totalInvest / windowDays
      : 0;

  // ── Tagesschleife: Monatsbetrag ÷ Kalendertage (Kosten veranschlagt: Fenster) ─
  const rows: BcCalcDay[] = [];
  const months: BcCalcMonth[] = [];
  let cumBenefit = 0;
  let cumCost = 0;
  let breakEvenDay: string | null = null;
  let firstCostDay: string | null = null;
  for (let d = axisStart; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const mIdx = monthDiff(axis.start, monthStart(d));
    const dim = daysInMonth(mIdx);
    const cost = hasAllocation ? (flows.cost[mIdx] ?? 0) / dim : estimatedCostAt(d);
    const benefit = ((flows.benefit[mIdx] ?? 0) + (flows.benefitUplift[mIdx] ?? 0)) / dim;
    const isForecast = mIdx > todayIndex;
    if (firstCostDay === null && cost > 0) firstCostDay = isoDay(d);
    cumBenefit += benefit;
    cumCost += cost;
    if (breakEvenDay === null && cumCost > 0 && cumBenefit >= cumCost) breakEvenDay = isoDay(d);
    const iso = isoDay(d);
    const gate = stageAtDay(d);
    rows.push({
      day: iso,
      gate,
      costPerDay: cost,
      benefitPerDay: benefit,
      cumBenefit,
      cumCost,
      net: cumBenefit - cumCost,
      isForecast,
    });

    // Monatsebene faellt im selben Durchlauf ab; ein zweiter Pass ueber die
    // Tageszeilen waere reine Arbeit fuer dasselbe Ergebnis.
    const ym = iso.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === ym) {
      last.gateTo = gate;
      last.cost += cost;
      last.benefit += benefit;
      last.cumBenefit = cumBenefit;
      last.cumCost = cumCost;
      last.net = cumBenefit - cumCost;
      last.isForecast = last.isForecast && isForecast;
    } else {
      months.push({
        month: ym,
        gateFrom: gate,
        gateTo: gate,
        cost,
        benefit,
        cumBenefit,
        cumCost,
        net: cumBenefit - cumCost,
        isForecast,
      });
    }
  }

  const totalCost = cumCost;
  const summary: BcCalcSummary = {
    // Effektiver Kostenbeginn (Allocation-Periode bzw. Umsetzungsfenster) —
    // nicht mehr zwingend der Backlog-Monat.
    costStart: firstCostDay ?? isoDay(eco.costStart),
    goLive: isoDay(eco.goLive),
    breakEvenDay,
    totalCost,
    estimatedCost: eco.totals.implementationCost,
    recurringAnnualAtTarget: eco.recurringBenefit,
    oneTimeAtTarget: eco.oneTimeBenefit,
    benefitCostRatioPct: totalCost > 0 ? (eco.recurringBenefit / totalCost) * 100 : null,
    firstDay: rows[0]?.day ?? isoDay(axisStart),
    lastDay: rows[rows.length - 1]?.day ?? isoDay(end),
    hasAllocation,
  };
  // Die Rechnung laeuft immer taggenau — gekappt wird nur, was den Client
  // erreicht. Sonst waeren Monatssummen und Tagesdetail zwei Rechenwege.
  return { rows: input.granularity === "month" ? [] : rows, months, summary };
}

/**
 * Was der Rechen-Reiter braucht: **alle Monate, aber nur die Tage eines
 * Monats**.
 *
 * Vorher reisten saemtliche Tageszeilen ins RSC-Payload — fuer ein laufendes
 * Epic rund 1 675 Zeilen und 239 KB —, obwohl die Tabelle zugeklappt oeffnet
 * und beim ersten Rendern keine einzige davon zeigt. Gerechnet wird weiterhin
 * taggenau; gekappt wird nur die Uebertragung.
 *
 * `dayMonth` ist `yyyy-mm`; ohne Angabe kommen gar keine Tage mit.
 */
export function buildEpicBusinessCaseCalcForTab(
  input: BcCalcInput,
  dayMonth?: string | undefined,
): BcCalcResult {
  const full = buildEpicBusinessCaseCalc({ ...input, granularity: "day" });
  return {
    ...full,
    rows: dayMonth ? full.rows.filter((r) => r.day.startsWith(dayMonth)) : [],
  };
}
