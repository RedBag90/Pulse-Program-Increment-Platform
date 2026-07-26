/**
 * Pure Rollup-Logic fuer das Ziele-Modul (V2).
 *
 * Konzept-Anker (Konzept §3): Geld faellt von unten nach oben.
 *
 *   KPI-Achievement = (current − baseline) / (target − baseline), clamp 0..1
 *   KPI-RealizedEUR = achievement × (target − baseline) × valuePerUnit
 *   KR-RealizedEUR  = Σ (contribution.weight × KPI-RealizedEUR) ueber gebundene KPIs
 *   Objective ⟵ Σ KR
 *   Theme     ⟵ Σ Objective  +  Σ Theme-direct-Epic
 *   Vision    ⟵ Σ Theme
 *
 * Planned-Seite spiegelbildlich: KR-PlannedEUR = (target − baseline) × valuePerUnit.
 * **KPI-Wertung (einmalig):** Realized = voller Wert bei Zielerreichung, ohne
 * Horizont-Anteiligung — konsistent mit dem Epic-„Realisierter Mehrwert"-Tile.
 * Run-Rate = Realized.
 *
 * Reine Funktionen, kein I/O — leicht testbar, leicht in Server-Views einbindbar.
 */

import { fulfillmentFraction } from "@/domain/kpi-direction";
import type { ProgressMode } from "@/domain/goal-progress-mode";

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
  const raw = fulfillmentFraction(kpi.baseline, kpi.target, kpi.current);
  return raw === null ? 0 : clamp01(raw);
}

/**
 * Geld-Rechnung fuer einen einzelnen KPI — **KPI-Wertung (einmalig)**:
 * `realized = achievement × planned` (voller Wert bei Zielerreichung, wie das
 * Epic-„Realisierter Mehrwert"-Tile; **keine** Horizont-Anteiligung). `runRate`
 * = derselbe volle Wert (Run-Rate = Realisierung im einmalig-Modell).
 */
export function kpiTrio(kpi: KpiInput): RollupTrio {
  const vpu = kpi.valuePerUnit ?? 0;
  if (kpi.baseline === null || kpi.target === null || vpu === 0) {
    return { planned: 0, realized: 0, runRate: 0 };
  }
  const span = Math.abs(kpi.target - kpi.baseline);
  const planned = span * vpu;
  const achievement = kpiAchievement(kpi);
  const realized = achievement * planned;
  return { planned, realized, runRate: realized };
}

/**
 * Geld-Rechnung fuer einen Key Result. Aggregiert die KPI-Beitraege mit
 * den Contribution-Weights; jede KPI kann ihren eigenen `valuePerUnit`
 * via Override haben.
 */
export function keyResultTrio(
  contributions: KrContributionInput[],
  kpisById: ReadonlyMap<string, KpiInput>,
): RollupTrio {
  let planned = 0;
  let realized = 0;
  let runRate = 0;
  for (const c of contributions) {
    const kpi = kpisById.get(c.kpiId);
    if (!kpi) continue;
    const vpu = c.valuePerUnitOverride ?? kpi.valuePerUnit ?? 0;
    const effective: KpiInput = { ...kpi, valuePerUnit: vpu };
    const trio = kpiTrio(effective);
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
): { achievement: number | null; contributionRealized: number } {
  if (!kpi) return { achievement: null, contributionRealized: 0 };
  const raw = fulfillmentFraction(kpi.baseline, kpi.target, kpi.current);
  const ach = raw === null ? null : clamp01(raw);
  const span = (kpi.target ?? 0) - (kpi.baseline ?? 0);
  const vpu = contribution.valuePerUnitOverride ?? kpi.valuePerUnit ?? 0;
  const realized = ach != null && vpu ? ach * vpu * span * contribution.weight : 0;
  return { achievement: ach, contributionRealized: realized };
}

/** Ein direkt an ein Ziel verknüpftes Epic samt seiner (nicht-gelöschten) KPIs. */
export interface EpicLinkInput {
  epicId: string;
  kpis: KpiInput[];
}

/**
 * Geld-Rechnung für die „Related work"-Epics eines Ziel-Knotens: die Summe
 * der KPI-Trios aller direkt verknüpften Epics. Ganzes Epic = alle seine KPIs
 * mit ihrem eigenen `valuePerUnit` (kein Contribution-Weight, keine Overrides —
 * Feinjustierung bleibt der KPI→KR-Bindung vorbehalten). Pendant zu
 * `keyResultTrio`; wird im Loader neben diesem in den Knoten-Trio summiert
 * (Konzept-Header „Σ Ziel-direkt-Epic"). Count-once garantiert, dass keine
 * KPI zusätzlich über eine `KrKpiContribution` gezählt wird.
 */
export function epicLinkTrio(links: ReadonlyArray<EpicLinkInput>): RollupTrio {
  const trios: RollupTrio[] = [];
  for (const link of links) {
    for (const kpi of link.kpis) {
      trios.push(kpiTrio(kpi));
    }
  }
  return sumTrios(trios);
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
 * Normalisierter 0..1-Fortschritt eines Key Results (baseline→target→current).
 * Fehlt baseline/target/current oder ist die Spanne 0, ergibt sich 0
 * (bzw. 1, wenn current bereits target erreicht). Basis für den
 * Objective-Rollup (ADR-0008).
 */
export function keyResultProgress(kr: {
  baseline: number | null;
  target: number | null;
  current: number | null;
}): number {
  const { baseline: b, target: t, current: c } = kr;
  if (b == null || t == null || c == null) return 0;
  const span = t - b;
  if (span === 0) return c === t ? 1 : 0;
  return clamp01((c - b) / span);
}

/**
 * Objective-Completion = (gewichteter) normalisierter Durchschnitt der
 * KR-Fortschritte in 0..1, **einheiten-unabhängig** (ADR-0008). `null`, wenn
 * es keine Key Results gibt. Gleiche/weggelassene Gewichte ⇒ arithmetischer
 * Durchschnitt (= Verhalten ohne Gewichte, Epic 3 baut darauf auf).
 */
export function rollupObjectiveProgress(
  progresses: readonly number[],
  weights?: readonly number[],
): number | null {
  if (progresses.length === 0) return null;
  const mean = () => clamp01(progresses.reduce((s, p) => s + clamp01(p), 0) / progresses.length);
  if (!weights || weights.length !== progresses.length) return mean();
  let wsum = 0;
  let acc = 0;
  for (let i = 0; i < progresses.length; i++) {
    const w = weights[i] ?? 0;
    wsum += w;
    acc += w * clamp01(progresses[i] ?? 0);
  }
  return wsum <= 0 ? mean() : clamp01(acc / wsum);
}

// ── Rekursiver Goal-Knoten-Rollup (Kaskaden-Vereinheitlichung) ──────────────

/**
 * Ein Knoten im rekursiven Goal-Baum, mit **vorberechneten** Eigen-Werten:
 * der Loader füllt `progressLeaf` (eigener Metrik-Fortschritt via
 * `keyResultProgress`, `null` wenn nicht messbar), `trioLeaf` (eigener Metrik-€
 * via `keyResultTrio`, Null-Trio für Zweige/manuelle Blätter) und
 * `trioEpicLinks` (via `epicLinkTrio`). Die Domäne besorgt nur die Rekursion.
 */
export interface RollupNode {
  /** Relatives Gewicht im Eltern-Rollup (Default 1). */
  weight: number;
  /** Fortschrittsquelle dieses Knotens (vom Loader effektiv aufgelöst). */
  mode: ProgressMode;
  /** Eigener Blatt-Fortschritt 0..1, `null` wenn nicht messbar / kein Blatt. */
  progressLeaf: number | null;
  /** Eigener Metrik-€ (Blatt). Null-Trio bei Zweigen/manuellen Blättern. */
  trioLeaf: RollupTrio;
  /** €-Beitrag der direkt an diesen Knoten verknüpften Epics. */
  trioEpicLinks: RollupTrio;
  children: RollupNode[];
}

/**
 * Rekursiver Fortschritt (Post-Order), gesteuert vom `mode`:
 *  - `rollup`  → (gewichteter) Durchschnitt der Kinder; Kinder ohne Fortschritt
 *               (`null`) werden ausgeklammert; ohne Kinder ⇒ `null`.
 *  - `manual` / `auto_kpi` → eigener `progressLeaf`, **auch wenn Kinder
 *               existieren** (expliziter Override der Fortschrittsquelle).
 */
export function nodeProgress(node: RollupNode): number | null {
  if (node.mode === "rollup") {
    if (node.children.length === 0) return null;
    const kept = node.children
      .map((c) => ({ p: nodeProgress(c), w: c.weight }))
      .filter((x): x is { p: number; w: number } => x.p !== null);
    if (kept.length === 0) return null;
    return rollupObjectiveProgress(
      kept.map((x) => x.p),
      kept.map((x) => x.w),
    );
  }
  return node.progressLeaf;
}

/**
 * Rekursiver €-Trio (Post-Order). Zweig ⇒ Summe der Kinder-Trios; Blatt ⇒
 * eigener Metrik-Trio. In beiden Fällen kommen die Epic-Link-Beiträge dieses
 * Knotens hinzu (Konzept-Header „Σ Ziel-direkt-Epic").
 */
export function nodeTrio(node: RollupNode): RollupTrio {
  const base = node.children.length > 0 ? sumTrios(node.children.map(nodeTrio)) : node.trioLeaf;
  return sumTrios([base, node.trioEpicLinks]);
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
