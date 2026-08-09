/**
 * LPM-Portfolio-Review — reines Rechenmodell (SAFe). *Eine* systemweite Regel
 * je Kennzahl, für alle Epics identisch (Spec). Kein I/O: der Loader
 * (`src/server/views/lpm-review-view.ts`) lädt + normalisiert die Prisma-Rows
 * und ruft {@link computeLpmReview}; hier lebt nur die Ableitung.
 *
 * Kennzahlen:
 *  - **Benefit Plan** (Epic) = Σ KPI-Planned-€ (100 % Zielerreichung, wie
 *    `epicBenefitFromKpis`; recurring annualisiert).
 *  - **Realisierungsfaktor** = f(Terminabweichung in PIs): 1,0 bei ≤0 PI Verzug,
 *    −`step` je PI Verzug, auf `floor` geklemmt. **Benefit Forecast** = Plan × Faktor.
 *  - **Terminabweichung (PIs)** = Ist-Ende-PI − Plan-Ende-PI.
 *  - **Plantreue** = termingerecht gelieferte Features ÷ zum Stichtag geplante.
 *  - **Performance** = bis Stichtag gelieferte ÷ bis Stichtag geplante (Durchsatz).
 *  - **Realisierter Benefit** (Burn-up) = Σ KPI-Achievement(≤ Stichtag) × Planned-€.
 *
 * Konvention (wie im Ziele-/Portfolio-Code): Verhältnisse sind 0..1.
 */

import { fulfillmentFraction } from "@/modules/core/kpi/domain/kpi-direction";
import { benefitKindOrDefault } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { recurringIntervalOrDefault } from "@/modules/core/kpi/domain/kpi-recurring-interval";
import { thresholdTier, type AmpelTier, type AmpelThresholds } from "@/domain/portfolio-ampel";

/**
 * Ampel einer Kennzahl **inklusive „neutral"** — für Epics/VS ohne Liefer-Signal
 * (keine Features bis zum Stichtag fällig). „neutral" ≠ „kritisch": ohne Daten
 * wird nichts rot gefärbt (sonst wirkt ein unbestücktes Portfolio als in Brand).
 */
export type LpmAmpel = AmpelTier | "neutral";

// ── Eingabetypen (vom Loader normalisiert) ──────────────────────────────────

/** Ein Program Increment als Zeitachsen-Bucket; `index` = Reihenfolge nach `startMs`. */
export interface LpmPi {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
}

/** KPI eines Epics — Decimals bereits zu number normalisiert, Messwerte chronologisch. */
export interface LpmKpiInput {
  baseline: number | null;
  target: number | null;
  valuePerUnit: number | null;
  benefitKind: string;
  recurringInterval: string;
  /** Aufsteigend nach `atMs` sortierte Messpunkte. */
  measurements: { atMs: number; value: number }[];
}

/** Ein Child-Feature eines Epics — Delivery-Status + geplantes PI-Ende + Ist-Datum. */
export interface LpmFeatureInput {
  status: string;
  /** Ende des zugewiesenen PIs (Soll-Liefertermin) oder null (Backlog/unassigned). */
  piEndMs: number | null;
  /** Ist-Lieferdatum (Feature.completedAt) oder null. */
  completedAtMs: number | null;
}

export interface LpmEpicInput {
  id: string;
  title: string;
  valueStreamId: string | null;
  valueStreamName: string | null;
  kpis: LpmKpiInput[];
  features: LpmFeatureInput[];
  /** Soll-Ende (Initiative.plannedEndAt) oder null. */
  plannedEndMs: number | null;
}

/** Realisierungsfaktor-Konfiguration: Abschlag je PI-Verzug, geklemmt auf `floor`. */
export interface RealisierungConfig {
  step: number;
  floor: number;
}

export const DEFAULT_REALISIERUNG: RealisierungConfig = { step: 0.1, floor: 0.4 };

export interface LpmReviewConfig {
  asOfMs: number;
  realisierung?: RealisierungConfig;
  ampel?: AmpelThresholds;
}

// ── Ausgabetypen ────────────────────────────────────────────────────────────

export interface LpmEpicRow {
  id: string;
  title: string;
  valueStreamId: string | null;
  valueStreamName: string | null;
  benefitPlan: number;
  benefitForecast: number;
  plantreue: number | null;
  performance: number | null;
  /** Ist-%-Fortschritt der Features (bis Stichtag geliefert ÷ zum Stichtag geplant). */
  progressActual: number | null;
  /** Soll-%-Fortschritt (immer 1 = 100 %, da „was bis Stichtag geplant war"). */
  progressTarget: number;
  terminabweichungPis: number;
  ampel: LpmAmpel;
  /** Konkrete Gremiums-Frage, aus Ampel + Terminabweichung abgeleitet. */
  entscheidung: string;
}

export interface LpmValueStreamRow {
  id: string | null;
  name: string;
  benefitPlan: number;
  benefitForecast: number;
  plantreue: number | null;
  performance: number | null;
  ampel: LpmAmpel;
  epicCount: number;
}

export interface LpmWaterfallStep {
  /** "start" | "loss" | "end" — Start/Ende neutral grau, Verlust rot. */
  kind: "start" | "loss" | "end";
  label: string;
  /** Balken-Wert (Verluste negativ). */
  value: number;
}

export interface LpmBurnupPoint {
  piId: string;
  label: string;
  plannedCum: number;
  /** null nach dem Stichtag (nur Plan + Forecast). */
  realizedCum: number | null;
  /** Forecast-Fortsetzung ab Stichtag; null davor. */
  forecastCum: number | null;
}

export interface LpmPortfolioSummary {
  benefitPlan: number;
  benefitForecast: number;
  /** Forecast − Plan (negativ = Fehlbetrag). */
  benefitDelta: number;
  /** Relatives Delta 0..1-artig (kann negativ sein). */
  benefitDeltaRatio: number;
  plantreue: number | null;
  performance: number | null;
  ampel: LpmAmpel;
  epicTotal: number;
  epicsOnPlan: number;
  epicsAtRisk: number;
  epicsCritical: number;
}

export interface LpmReviewModel {
  portfolio: LpmPortfolioSummary;
  valueStreams: LpmValueStreamRow[];
  epics: LpmEpicRow[];
  waterfall: LpmWaterfallStep[];
  burnup: LpmBurnupPoint[];
}

// ── KPI-€ ───────────────────────────────────────────────────────────────────

/** Planned-€ eines KPIs bei 100 % Zielerreichung (recurring annualisiert). */
export function kpiPlanned(k: LpmKpiInput): number {
  if (k.valuePerUnit == null || k.baseline == null || k.target == null) return 0;
  const base = Math.abs(k.target - k.baseline) * k.valuePerUnit;
  if (base === 0) return 0;
  if (benefitKindOrDefault(k.benefitKind) === "one_time") return base;
  return recurringIntervalOrDefault(k.recurringInterval) === "monthly" ? base * 12 : base;
}

/** Messwert zum Stichtag: letzter Messpunkt ≤ `cutoffMs`, sonst `baseline`. */
export function measurementValueAt(
  measurements: { atMs: number; value: number }[],
  cutoffMs: number,
  fallback: number | null,
): number | null {
  let v = fallback;
  for (const m of measurements) {
    if (m.atMs <= cutoffMs) v = m.value;
    else break;
  }
  return v;
}

/** Realisierter €-Anteil eines KPIs zum Stichtag = Achievement(≤cutoff) × Planned. */
export function kpiRealizedAt(k: LpmKpiInput, cutoffMs: number): number {
  const planned = kpiPlanned(k);
  if (planned === 0) return 0;
  const value = measurementValueAt(k.measurements, cutoffMs, k.baseline);
  const frac = fulfillmentFraction(k.baseline, k.target, value);
  const ach = frac == null ? 0 : Math.min(1, Math.max(0, frac));
  return ach * planned;
}

const epicBenefitPlan = (e: LpmEpicInput): number => e.kpis.reduce((s, k) => s + kpiPlanned(k), 0);

const epicRealizedAt = (e: LpmEpicInput, cutoffMs: number): number =>
  e.kpis.reduce((s, k) => s + kpiRealizedAt(k, cutoffMs), 0);

// ── Termin / PI ───────────────────────────────────────────────────────────

/**
 * PI-Index für ein Datum: der erste PI, dessen Ende ≥ `dateMs` (= „landet in
 * diesem PI"); nach dem letzten PI → letzter Index; vor dem ersten → 0.
 * `pis` müssen nach `startMs` aufsteigen. Leere Liste → -1.
 */
export function piIndexForDate(pis: LpmPi[], dateMs: number): number {
  if (pis.length === 0) return -1;
  for (let i = 0; i < pis.length; i++) {
    if (dateMs <= pis[i]!.endMs) return i;
  }
  return pis.length - 1;
}

/** Projiziertes/tatsächliches Ist-Ende eines Epics (max Feature-Datum), oder null. */
function epicIstEndMs(e: LpmEpicInput): number | null {
  if (e.features.length === 0) return null;
  const allDone = e.features.every((f) => f.status === "completed");
  const pick = (f: LpmFeatureInput): number | null =>
    allDone ? (f.completedAtMs ?? f.piEndMs) : (f.piEndMs ?? f.completedAtMs);
  const times = e.features.map(pick).filter((x): x is number => x != null);
  return times.length ? Math.max(...times) : null;
}

/** Terminabweichung in PIs: Ist-Ende-PI − Plan-Ende-PI (positiv = Verzug). */
export function epicTerminabweichungPis(e: LpmEpicInput, pis: LpmPi[]): number {
  const istEnd = epicIstEndMs(e);
  const planEnd = e.plannedEndMs;
  if (istEnd == null || planEnd == null) return 0;
  return piIndexForDate(pis, istEnd) - piIndexForDate(pis, planEnd);
}

/** Realisierungsfaktor 0..1 aus PI-Verzug (≤0 → 1,0; sonst −step·Verzug, ⌊floor⌋). */
export function realisierungsfaktor(
  deltaPis: number,
  cfg: RealisierungConfig = DEFAULT_REALISIERUNG,
): number {
  if (deltaPis <= 0) return 1;
  return Math.max(cfg.floor, 1 - deltaPis * cfg.step);
}

// ── Plantreue / Performance (Feature-Zähler; VS/Portfolio aggregieren diese) ──

interface FeatureCounts {
  /** Zum Stichtag geplant (Feature-PI endet ≤ Stichtag). */
  plannedToDate: number;
  /** Davon termingerecht geliefert (completedAt ≤ Plan-PI-Ende). */
  onTime: number;
  /** Bis Stichtag geliefert (completed, completedAt ≤ Stichtag oder unbekannt). */
  doneToDate: number;
}

export function epicFeatureCounts(e: LpmEpicInput, asOfMs: number): FeatureCounts {
  let plannedToDate = 0;
  let onTime = 0;
  let doneToDate = 0;
  for (const f of e.features) {
    const plannedDue = f.piEndMs != null && f.piEndMs <= asOfMs;
    if (plannedDue) plannedToDate += 1;
    const done = f.status === "completed";
    if (done && (f.completedAtMs == null || f.completedAtMs <= asOfMs)) doneToDate += 1;
    if (plannedDue && done && f.completedAtMs != null && f.completedAtMs <= f.piEndMs!) onTime += 1;
  }
  return { plannedToDate, onTime, doneToDate };
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

/**
 * Ampel aus Plantreue + Performance: die schwächere der beiden bestimmt das Tier
 * (konservativ). Ohne Liefer-Signal (beide null) → „neutral" statt rot.
 */
function ampelFrom(
  plantreue: number | null,
  performance: number | null,
  thresholds?: AmpelThresholds,
): LpmAmpel {
  if (plantreue == null && performance == null) return "neutral";
  const worst = Math.min(plantreue ?? 1, performance ?? 1);
  return thresholdTier(worst, thresholds);
}

/** Gremiums-Entscheidung aus Ampel + Verzug. */
function decisionFor(ampel: LpmAmpel, deltaPis: number): string {
  if (ampel === "rose") return deltaPis >= 2 ? "Pivot / Stop?" : "Scope prüfen";
  if (ampel === "amber") return "Scope prüfen";
  return "Keine";
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────

export function computeLpmReview(input: {
  epics: LpmEpicInput[];
  pis: LpmPi[];
  config: LpmReviewConfig;
}): LpmReviewModel {
  const { epics, pis, config } = input;
  const asOfMs = config.asOfMs;
  const rCfg = config.realisierung ?? DEFAULT_REALISIERUNG;
  const aThresh = config.ampel;

  // ── Epic-Zeilen ──
  const epicRows: LpmEpicRow[] = epics.map((e) => {
    const benefitPlan = epicBenefitPlan(e);
    const deltaPis = epicTerminabweichungPis(e, pis);
    const benefitForecast = benefitPlan * realisierungsfaktor(deltaPis, rCfg);
    const counts = epicFeatureCounts(e, asOfMs);
    const plantreue = ratio(counts.onTime, counts.plannedToDate);
    const performance = ratio(counts.doneToDate, counts.plannedToDate);
    const ampel = ampelFrom(plantreue, performance, aThresh);
    return {
      id: e.id,
      title: e.title,
      valueStreamId: e.valueStreamId,
      valueStreamName: e.valueStreamName,
      benefitPlan,
      benefitForecast,
      plantreue,
      performance,
      progressActual: performance,
      progressTarget: 1,
      terminabweichungPis: deltaPis,
      ampel,
      entscheidung: decisionFor(ampel, deltaPis),
    };
  });

  // ── Value-Stream-Aggregation (Feature-Zähler summieren, nicht Ratios mitteln) ──
  const vsMap = new Map<
    string,
    {
      id: string | null;
      name: string;
      benefitPlan: number;
      benefitForecast: number;
      plannedToDate: number;
      onTime: number;
      doneToDate: number;
      epicCount: number;
    }
  >();
  for (const e of epics) {
    const key = e.valueStreamId ?? "__none__";
    const counts = epicFeatureCounts(e, asOfMs);
    const row = epicRows.find((r) => r.id === e.id)!;
    const agg = vsMap.get(key) ?? {
      id: e.valueStreamId,
      name: e.valueStreamName ?? "Ohne Value Stream",
      benefitPlan: 0,
      benefitForecast: 0,
      plannedToDate: 0,
      onTime: 0,
      doneToDate: 0,
      epicCount: 0,
    };
    agg.benefitPlan += row.benefitPlan;
    agg.benefitForecast += row.benefitForecast;
    agg.plannedToDate += counts.plannedToDate;
    agg.onTime += counts.onTime;
    agg.doneToDate += counts.doneToDate;
    agg.epicCount += 1;
    vsMap.set(key, agg);
  }
  const valueStreams: LpmValueStreamRow[] = [...vsMap.values()]
    .map((v) => {
      const plantreue = ratio(v.onTime, v.plannedToDate);
      const performance = ratio(v.doneToDate, v.plannedToDate);
      const ampel = ampelFrom(plantreue, performance, aThresh);
      return {
        id: v.id,
        name: v.name,
        benefitPlan: v.benefitPlan,
        benefitForecast: v.benefitForecast,
        plantreue,
        performance,
        ampel,
        epicCount: v.epicCount,
      };
    })
    .sort((a, b) => b.benefitPlan - a.benefitPlan);

  // ── Portfolio-Summe ──
  const benefitPlan = epicRows.reduce((s, r) => s + r.benefitPlan, 0);
  const benefitForecast = epicRows.reduce((s, r) => s + r.benefitForecast, 0);
  const totalPlanned = epicRows.reduce(
    (s, r) => s + epicFeatureCounts(epics.find((e) => e.id === r.id)!, asOfMs).plannedToDate,
    0,
  );
  const totalOnTime = epics.reduce((s, e) => s + epicFeatureCounts(e, asOfMs).onTime, 0);
  const totalDone = epics.reduce((s, e) => s + epicFeatureCounts(e, asOfMs).doneToDate, 0);
  const pPlantreue = ratio(totalOnTime, totalPlanned);
  const pPerformance = ratio(totalDone, totalPlanned);
  const portfolioAmpel = ampelFrom(pPlantreue, pPerformance, aThresh);

  const portfolio: LpmPortfolioSummary = {
    benefitPlan,
    benefitForecast,
    benefitDelta: benefitForecast - benefitPlan,
    benefitDeltaRatio: benefitPlan === 0 ? 0 : (benefitForecast - benefitPlan) / benefitPlan,
    plantreue: pPlantreue,
    performance: pPerformance,
    ampel: portfolioAmpel,
    epicTotal: epicRows.length,
    epicsOnPlan: epicRows.filter((r) => r.ampel === "green").length,
    epicsAtRisk: epicRows.filter((r) => r.ampel === "amber").length,
    epicsCritical: epicRows.filter((r) => r.ampel === "rose").length,
  };

  // ── Wasserfall: Start (Plan) → Verlust je VS (rot) → Ende (Forecast) ──
  const waterfall: LpmWaterfallStep[] = [
    { kind: "start", label: "Benefit Plan", value: benefitPlan },
    ...valueStreams
      .map((v) => ({
        kind: "loss" as const,
        label: v.name,
        value: v.benefitForecast - v.benefitPlan, // ≤ 0
      }))
      .filter((s) => s.value < 0),
    { kind: "end", label: "Benefit Forecast", value: benefitForecast },
  ];

  // ── Burn-up je PI ──
  const asOfPiIndex = piIndexForDate(pis, asOfMs);
  const planEndIndexByEpic = new Map(
    epics.map((e) => [
      e.id,
      piIndexForDate(
        pis,
        e.plannedEndMs ?? epicIstEndMs(e) ?? (pis.length ? pis[pis.length - 1]!.endMs : asOfMs),
      ),
    ]),
  );
  const realizedAtAsOf = epics.reduce((s, e) => s + epicRealizedAt(e, asOfMs), 0);
  const lastPlanIndex = Math.max(0, ...[...planEndIndexByEpic.values()]);
  const burnup: LpmBurnupPoint[] = pis.map((pi, i) => {
    const plannedCum = epics.reduce(
      (s, e) => s + ((planEndIndexByEpic.get(e.id) ?? 0) <= i ? epicBenefitPlan(e) : 0),
      0,
    );
    const realizedCum =
      i <= asOfPiIndex ? epics.reduce((s, e) => s + epicRealizedAt(e, pi.endMs), 0) : null;
    // Forecast-Tail: ab Stichtag linear von realizedAtAsOf → benefitForecast am letzten Plan-PI.
    let forecastCum: number | null = null;
    if (i >= asOfPiIndex) {
      if (i === asOfPiIndex) forecastCum = realizedAtAsOf;
      else if (lastPlanIndex > asOfPiIndex) {
        const t = Math.min(1, (i - asOfPiIndex) / (lastPlanIndex - asOfPiIndex));
        forecastCum = realizedAtAsOf + t * (benefitForecast - realizedAtAsOf);
      } else forecastCum = benefitForecast;
    }
    return { piId: pi.id, label: pi.label, plannedCum, realizedCum, forecastCum };
  });

  return { portfolio, valueStreams, epics: epicRows, waterfall, burnup };
}
