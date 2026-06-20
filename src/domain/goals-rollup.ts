/**
 * Pure Rollup-Logic fuer das Ziele-Modul (V2).
 *
 * Konzept-Anker (Konzept §3): Geld faellt von unten nach oben.
 *
 *   KPI-Achievement = (current − baseline) / (target − baseline), clamp 0..1
 *   KPI-RealizedEUR = achievement × (target − baseline) × valuePerUnit
 *                     × horizonShareDays / 365
 *   KR-RealizedEUR  = Σ (contribution.weight × KPI-RealizedEUR) ueber gebundene KPIs
 *   Objective ⟵ Σ KR
 *   Theme     ⟵ Σ Objective  +  Σ Theme-direct-Epic
 *   Vision    ⟵ Σ Theme
 *
 * Planned-Seite spiegelbildlich: KR-PlannedEUR = (target − baseline) × valuePerUnit.
 * Run-Rate = lineare Hochrechnung der Realisierung auf das Horizont-Ende.
 *
 * Reine Funktionen, kein I/O — leicht testbar, leicht in Server-Views einbindbar.
 */

export interface KpiInput {
  id: string;
  baseline: number | null;
  target: number | null;
  current: number | null;
  /** Default-€-Pro-Einheit am KPI (vom Finance Controller). */
  valuePerUnit: number | null;
}

export interface KrContributionInput {
  kpiId: string;
  weight: number;
  /** Optional Override gegenueber `Kpi.valuePerUnit`. */
  valuePerUnitOverride: number | null;
}

export interface RollupTrio {
  /** Soll-€ — was die Hypothese verspricht (target × valuePerUnit). */
  planned: number;
  /** Ist-€ — aus aktueller Achievement gerechnet, anteilig auf bisherigen Horizont. */
  realized: number;
  /** Lineare Hochrechnung der Realisierung auf das Horizont-Ende. */
  runRate: number;
}

/** Spreizung 0..1, ohne Geld-Konversion — fuer „% Achievement"-Badges. */
export function kpiAchievement(kpi: KpiInput): number {
  if (kpi.baseline === null || kpi.target === null || kpi.current === null) return 0;
  const span = kpi.target - kpi.baseline;
  if (span === 0) return 0;
  const raw = (kpi.current - kpi.baseline) / span;
  return clamp01(raw);
}

/**
 * Geld-Rechnung fuer einen einzelnen KPI. `horizonShare` ist der Anteil
 * des Horizonts, der bereits verstrichen ist (0..1); fuer Run-Rate
 * wird die Realisierung mit 1/horizonShare hochgerechnet.
 */
export function kpiTrio(kpi: KpiInput, horizonShare: number): RollupTrio {
  const vpu = kpi.valuePerUnit ?? 0;
  if (kpi.baseline === null || kpi.target === null || vpu === 0) {
    return { planned: 0, realized: 0, runRate: 0 };
  }
  const span = Math.abs(kpi.target - kpi.baseline);
  const planned = span * vpu;
  const achievement = kpiAchievement(kpi);
  const realized = achievement * planned * clamp01(horizonShare);
  // Run-Rate: extrapoliert Realisierung auf gesamten Horizont. Wenn schon
  // > 0 % vom Horizont verstrichen, projiziere proportional; sonst = 0.
  const runRate = horizonShare > 0 ? realized / clamp01(horizonShare) : 0;
  return { planned, realized, runRate };
}

/**
 * Geld-Rechnung fuer einen Key Result. Aggregiert die KPI-Beitraege mit
 * den Contribution-Weights; jede KPI kann ihren eigenen `valuePerUnit`
 * via Override haben.
 */
export function keyResultTrio(
  contributions: KrContributionInput[],
  kpisById: ReadonlyMap<string, KpiInput>,
  horizonShare: number,
): RollupTrio {
  let planned = 0;
  let realized = 0;
  let runRate = 0;
  for (const c of contributions) {
    const kpi = kpisById.get(c.kpiId);
    if (!kpi) continue;
    const vpu = c.valuePerUnitOverride ?? kpi.valuePerUnit ?? 0;
    const effective: KpiInput = { ...kpi, valuePerUnit: vpu };
    const trio = kpiTrio(effective, horizonShare);
    planned += c.weight * trio.planned;
    realized += c.weight * trio.realized;
    runRate += c.weight * trio.runRate;
  }
  return { planned, realized, runRate };
}

/**
 * Pro-KPI-Beitrag innerhalb eines Key Results: Achievement-Anteil sowie
 * realisierter €-Anteil dieses einen KPI an seinem KR. Pendant zu
 * `keyResultTrio`, das die Summe rechnet; hier liefern wir die Einzel-
 * Komponente fuer Anzeigen (KPI-Tab, KPI-Coverage-Zeile, etc.).
 */
export function kpiContributionDetail(
  kpi: KpiInput | undefined,
  contribution: KrContributionInput,
  horizonShare: number,
): { achievement: number | null; contributionRealized: number } {
  if (!kpi) return { achievement: null, contributionRealized: 0 };
  const span = (kpi.target ?? 0) - (kpi.baseline ?? 0);
  const ach =
    kpi.current != null && span !== 0
      ? clamp01(((kpi.current ?? 0) - (kpi.baseline ?? 0)) / span)
      : null;
  const vpu = contribution.valuePerUnitOverride ?? kpi.valuePerUnit ?? 0;
  const realized = ach != null && vpu ? ach * vpu * span * contribution.weight * horizonShare : 0;
  return { achievement: ach, contributionRealized: realized };
}

/** Aggregiert eine Liste von Trio's. */
export function sumTrios(trios: ReadonlyArray<RollupTrio>): RollupTrio {
  return trios.reduce(
    (acc, t) => ({
      planned: acc.planned + t.planned,
      realized: acc.realized + t.realized,
      runRate: acc.runRate + t.runRate,
    }),
    { planned: 0, realized: 0, runRate: 0 },
  );
}

/**
 * Drift-Heuristik: Run-Rate < 70 % von Planned → at-risk. Wird im UI
 * als ⚠-Badge angezeigt (auf jeder Ebene).
 */
export function isAtRisk(trio: RollupTrio, threshold = 0.7): boolean {
  if (trio.planned <= 0) return false;
  return trio.runRate / trio.planned < threshold;
}

/**
 * Horizont-Anteil: wie viel des Akkumulations-Zeitraums ist schon
 * verstrichen? 0 = Start, 1 = Ende. Werte ausserhalb werden geklemmt.
 */
export function horizonShare(now: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const elapsed = now.getTime() - start.getTime();
  return clamp01(elapsed / total);
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
