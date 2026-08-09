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
import { kpiDelta } from "@/domain/kpi-valuation";
import {
  aggregatesFromChildren,
  type ProgressMode,
} from "@/modules/core/goals/domain/goal-progress-mode";

export interface KpiInput {
  id: string;
  baseline: number | null;
  target: number | null;
  current: number | null;
  /** Default-€-Pro-Einheit am KPI (vom Finance Controller). */
  valuePerUnit: number | null;
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

/** Ein direkt an ein Ziel verknüpftes Epic samt seiner (nicht-gelöschten) KPIs. */
export interface EpicLinkInput {
  epicId: string;
  kpis: KpiInput[];
}

/**
 * Geld-Rechnung für die „Related work"-Epics eines Ziel-Knotens: die Summe
 * der KPI-Trios aller direkt verknüpften Epics. Ganzes Epic = alle seine KPIs
 * mit ihrem eigenen `valuePerUnit`. Wird im Loader in den Knoten-Trio summiert
 * (Konzept-Header „Σ Ziel-direkt-Epic"). Der €-Wert eines Ziels stammt damit
 * ausschließlich aus verknüpften Epics + Kinder-Rollup.
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
  /**
   * Ob dieser Knoten in den Fortschritt/€-Rollup **seines Elternteils** zählt
   * (Asana „Remove from automatic progress"). `false` blendet ihn — nicht seine
   * eigenen Kinder — aus dem Eltern-Ø/Σ aus; der Knoten selbst bleibt sichtbar.
   */
  includeInRollup: boolean;
  /** Fortschrittsquelle dieses Knotens (vom Loader effektiv aufgelöst). */
  mode: ProgressMode;
  /** Eigener Blatt-Fortschritt 0..1, `null` wenn nicht messbar / kein Blatt. */
  progressLeaf: number | null;
  /** Eigener Metrik-€ (Blatt). Null-Trio bei Zweigen/manuellen Blättern. */
  trioLeaf: RollupTrio;
  /** €-Beitrag der direkt an diesen Knoten verknüpften Epics. */
  trioEpicLinks: RollupTrio;
  children: RollupNode[];
  // ── Einheiten-Kaskade (dritte Achse, orthogonal zu Progress/€) ──
  // Optional: bis der Loader (goals-forest) sie füllt, verhält sich die
  // Einheiten-Achse als Null (kein Effekt auf Progress/€-Rollup).
  /** Eigener Metrik-Wert in EIGENER Einheit (Blatt). Default Null-Trio. */
  unitValueLeaf?: RollupTrio;
  /** Beitrag der verknüpften Epic-Erfolgs-KPIs, bereits in EIGENER Einheit. */
  unitEpicLinks?: RollupTrio;
  /**
   * Umrechnung EIGENE Einheit → ELTERN-Einheit (`Objective.parentUnitPerChildUnit`),
   * angewandt wenn dieser Knoten in seinen Elternteil rollt. Null = kein Beitrag.
   */
  childUnitFactor?: number | null;
}

/**
 * Rekursiver Fortschritt (Post-Order), gesteuert vom `mode`:
 *  - aggregierend (`rollup`, oder `kpi_tree`-**Ast**) → (gewichteter) Durchschnitt
 *    der Kinder; Kinder ohne Fortschritt (`null`) werden ausgeklammert; ohne
 *    Kinder ⇒ `null`. (Der `kpi_tree`-Ast bekommt hier den Ø als Basis; ein
 *    wert-basiertes Override rechnet der Loader in `goals-forest.build()`.)
 *  - sonst (`manual` / `auto_kpi` / `kpi_tree`-**Blatt**) → eigener `progressLeaf`,
 *    **auch wenn Kinder existieren** (expliziter Override der Fortschrittsquelle).
 */
export function nodeProgress(node: RollupNode): number | null {
  // `rollup` aggregiert immer (ohne verwertbare Kinder ⇒ null); `kpi_tree`
  // aggregiert nur als Ast (mit Kindern), sonst gewinnt sein Blatt-`progressLeaf`.
  if (node.mode === "rollup" || aggregatesFromChildren(node.mode, node.children.length > 0)) {
    const kept = node.children
      .filter((c) => c.includeInRollup)
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
  const base =
    node.children.length > 0
      ? sumTrios(node.children.filter((c) => c.includeInRollup).map(nodeTrio))
      : node.trioLeaf;
  return sumTrios([base, node.trioEpicLinks]);
}

// ── Einheiten-Kaskade (Unit→Unit) ───────────────────────────────────────────

const ZERO_TRIO: RollupTrio = { planned: 0, realized: 0, runRate: 0 };

/** Skaliert einen Trio linear (Einheiten-Umrechnung entlang einer Baum-Kante). */
export function scaleTrio(trio: RollupTrio, factor: number): RollupTrio {
  return {
    planned: trio.planned * factor,
    realized: trio.realized * factor,
    runRate: trio.runRate * factor,
  };
}

/** Bei recurring+monthly auf Jahres-Run-Rate hochrechnen (×12), sonst ×1 —
 *  konsistent mit `epicBenefitFromKpis` (epic-economics.ts). */
function intervalMultiplier(impactKind: string, recurringInterval: string): number {
  return impactKind === "recurring" && recurringInterval === "monthly" ? 12 : 1;
}

/**
 * Wert einer gewählten Epic-Erfolgs-KPI-Bewegung in der ZIEL-Einheit:
 *   planned  = |target − baseline| × conversionFactor × interval
 *   realized = kpiDelta(baseline,target,current) × conversionFactor × interval
 *   runRate  = realized (einmalig-Wertung, wie kpiTrio)
 * `conversionFactor` = Ziel-Einheit je 1 KPI-Einheit (z. B. 10000 €/Wagon).
 */
export function epicSuccessKpiContribution(
  kpi: KpiInput,
  conversionFactor: number | null,
  impactKind: string,
  recurringInterval: string,
): RollupTrio {
  if (conversionFactor == null || conversionFactor === 0) return ZERO_TRIO;
  if (kpi.baseline === null || kpi.target === null) return ZERO_TRIO;
  const mult = conversionFactor * intervalMultiplier(impactKind, recurringInterval);
  const span = Math.abs(kpi.target - kpi.baseline);
  const planned = span * mult;
  const realized = kpiDelta(kpi) * mult;
  return { planned, realized, runRate: realized };
}

/**
 * Rekursiver Wert eines Knotens in SEINER EIGENEN Einheit (Post-Order),
 * `mode`-bewusst (spiegelt `nodeProgress`, damit ein manuell gepflegtes Ziel
 * vom Epic-Rollup entkoppelt bleibt):
 *  - aggregierend (`rollup`, oder `kpi_tree`-Ast) mit Kindern → Σ (nodeUnitValue(Kind)
 *    × Kind.childUnitFactor) für Kinder mit `includeInRollup`, PLUS eigene Epic-Beiträge.
 *  - sonst (`manual` / `auto_kpi` / `kpi_tree`-Blatt) → eigenes Blatt gewinnt:
 *    `unitValueLeaf` + eigene Epic-Link-Beiträge.
 */
export function nodeUnitValue(node: RollupNode): RollupTrio {
  const epicLinks = node.unitEpicLinks ?? ZERO_TRIO;
  if (aggregatesFromChildren(node.mode, node.children.length > 0)) {
    const childSum = sumTrios(
      node.children
        .filter((c) => c.includeInRollup)
        .map((c) => scaleTrio(nodeUnitValue(c), c.childUnitFactor ?? 0)),
    );
    return sumTrios([childSum, epicLinks]);
  }
  return sumTrios([node.unitValueLeaf ?? ZERO_TRIO, epicLinks]);
}

/** Metadaten eines Ziel-Knotens für den Aufstieg zum Top-Ziel. */
export interface GoalNodeMeta {
  id: string;
  parentId: string | null;
  name: string;
  /** Metrik-Einheit dieses Knotens (Freitext-Label). */
  unit: string | null;
  /** Umrechnung eigene Einheit → Eltern-Einheit. Null = kein Beitrag nach oben. */
  parentUnitPerChildUnit: number | null;
}

/** Ein Erfolgs-KPI-Link eines Epics an einen Ziel-Knoten. */
export interface EpicGoalLinkInput {
  objectiveId: string;
  kpi: KpiInput;
  conversionFactor: number | null;
  impactKind: string;
  recurringInterval: string;
  /** Name der treibenden KPI (nur für die Anzeige-Kaskade). */
  kpiName?: string | null;
}

/** Eine Business-Case-Nutzen-Zeile: Beitrag des Epics zu einem Top-Ziel. */
export interface TopGoalBenefit {
  topGoalId: string;
  topGoalName: string;
  /** Einheit des Top-Ziels (Freitext-Label). */
  unit: string | null;
  planned: number;
  realized: number;
  impactKind: string;
}

/**
 * Business-Case-Nutzen anhand der TOP-Ziel-KPI(s): rechnet jeden Erfolgs-KPI-Link
 * die Eltern-Kette hoch (× Π `parentUnitPerChildUnit`) bis zum Top-Ziel und weist
 * den Wert in dessen Einheit aus. Ist ein Faktor in der Kette null, bricht der
 * Beitrag ab (0 — kein einheiten-basierter Beitrag). Gruppiert nach
 * (Top-Ziel × impactKind) ⇒ mehrere Zeilen bei mehreren Top-Zielen.
 */
export function epicTopGoalBenefits(
  links: readonly EpicGoalLinkInput[],
  nodesById: ReadonlyMap<string, GoalNodeMeta>,
): TopGoalBenefit[] {
  const grouped = new Map<string, TopGoalBenefit>();
  for (const link of links) {
    if (link.conversionFactor == null) continue;
    let trio = epicSuccessKpiContribution(
      link.kpi,
      link.conversionFactor,
      link.impactKind,
      link.recurringInterval,
    );
    // Aufstieg zum Top-Ziel, jede Kante skaliert die Einheit.
    let node = nodesById.get(link.objectiveId);
    if (!node) continue;
    const seen = new Set<string>();
    while (node.parentId !== null) {
      if (seen.has(node.id)) break; // Zyklus-Schutz
      seen.add(node.id);
      trio = scaleTrio(trio, node.parentUnitPerChildUnit ?? 0);
      const parent = nodesById.get(node.parentId);
      if (!parent) break;
      node = parent;
    }
    const top = node;
    const key = `${top.id}::${link.impactKind}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.planned += trio.planned;
      prev.realized += trio.realized;
    } else {
      grouped.set(key, {
        topGoalId: top.id,
        topGoalName: top.name,
        unit: top.unit,
        planned: trio.planned,
        realized: trio.realized,
        impactKind: link.impactKind,
      });
    }
  }
  return [...grouped.values()];
}

/** Eine Stufe der Nutzen-Kaskade: der Beitrag in der Einheit dieses Ziel-Knotens. */
export interface CascadeStep {
  goalId: string;
  goalName: string;
  /** Einheit dieses Knotens (Freitext-Label). */
  unit: string | null;
  planned: number;
  realized: number;
  /** true, wenn die Umrechnung ZU dieser Ebene fehlte (`parentUnitPerChildUnit` null)
   *  ⇒ der Beitrag bricht hier ab (0). Macht Konfigurationslücken in der Kaskade sichtbar. */
  brokenHere: boolean;
}

/** Der Kaskaden-Beitrag EINES Erfolgs-KPI-Links, Ebene für Ebene bis zum Top-Ziel. */
export interface EpicCascadeContribution {
  linkedGoalId: string;
  impactKind: string;
  /** Name der treibenden KPI (für die Blatt-Annotation im Anzeige-Baum). */
  kpiName: string | null;
  /** Vom verknüpften Ziel (Index 0) bis zum Top-Ziel (letzter Eintrag); Wert je in dessen Einheit. */
  steps: CascadeStep[];
}

/**
 * Wie `epicTopGoalBenefits`, aber gibt **jede Zwischenstufe** der Einheiten-Kaskade
 * aus (verknüpftes Ziel → … → Top-Ziel), statt nur den Top-Endwert. Nutzt denselben
 * Aufstieg (× `parentUnitPerChildUnit` je Kante); markiert die Ebene, an der ein
 * fehlender Faktor den Beitrag abbrechen lässt. Für die „Beitrag über die Kaskade"-
 * Sicht im Business-Case-Nutzen.
 */
export function epicCascadeBreakdown(
  links: readonly EpicGoalLinkInput[],
  nodesById: ReadonlyMap<string, GoalNodeMeta>,
): EpicCascadeContribution[] {
  const out: EpicCascadeContribution[] = [];
  for (const link of links) {
    if (link.conversionFactor == null) continue;
    const start = nodesById.get(link.objectiveId);
    if (!start) continue;
    let trio = epicSuccessKpiContribution(
      link.kpi,
      link.conversionFactor,
      link.impactKind,
      link.recurringInterval,
    );
    const steps: CascadeStep[] = [
      {
        goalId: start.id,
        goalName: start.name,
        unit: start.unit,
        planned: trio.planned,
        realized: trio.realized,
        brokenHere: false,
      },
    ];
    let node = start;
    const seen = new Set<string>([node.id]);
    while (node.parentId !== null) {
      const parent = nodesById.get(node.parentId);
      if (!parent || seen.has(parent.id)) break; // fehlend / Zyklus
      seen.add(parent.id);
      const factor = node.parentUnitPerChildUnit;
      trio = scaleTrio(trio, factor ?? 0);
      steps.push({
        goalId: parent.id,
        goalName: parent.name,
        unit: parent.unit,
        planned: trio.planned,
        realized: trio.realized,
        brokenHere: factor == null,
      });
      node = parent;
    }
    out.push({
      linkedGoalId: link.objectiveId,
      impactKind: link.impactKind,
      kpiName: link.kpiName ?? null,
      steps,
    });
  }
  return out;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
