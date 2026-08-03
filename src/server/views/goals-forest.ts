/**
 * **Goal-Forest read-model** — die *reine* Ableitung „normalisierte Objective-
 * Zeilen + Lookups → GoalNode-Baum (mit €-Trios/Fortschritt) und Fortschrittsgraf".
 *
 * Der Loader ([ziele-view.ts](src/server/views/ziele-view.ts)) ist der Adapter: er lädt via Prisma und
 * normalisiert (Decimal→number, JSON→parsed, Date→ISO) in die Eingabetypen unten;
 * diese Datei besitzt die gesamte Derivation und ist **DB-frei testbar**.
 *
 * Der Seam ist `resolveNode` — die *eine* Auflösung „Zeile → effektive
 * Fortschrittsquelle (progressMode) + Ist-Wert + progressLeaf/trioLeaf/
 * trioEpicLinks". Sowohl der Baum (`buildStrategyTree`) als auch der Graf
 * (`buildProgressChart`) verwenden `effectiveProgressMode` als eine Regel — es
 * gibt keinen zweiten Schatten-Baum mehr im Loader (RollupNode/SeriesNode leben
 * hinter diesem Seam).
 */

import {
  keyResultProgress,
  epicLinkTrio,
  epicSuccessKpiContribution,
  sumTrios,
  nodeProgress,
  nodeTrio,
  nodeUnitValue,
  type KpiInput,
  type RollupTrio,
  type RollupNode,
} from "@/domain/goals-rollup";
import { kpiDelta } from "@/domain/kpi-valuation";
import {
  effectiveProgressMode,
  autoKpiCurrent,
  isMeasurableGoal,
  derivesCurrentFromKpis,
  aggregatesFromChildren,
  usesValueBasedCompletion,
  type ProgressMode,
  type AutoKpiLink,
} from "@/domain/goal-progress-mode";
import {
  buildAutoKpiSeries,
  buildNodeProgressSeries,
  type SeriesNode,
} from "@/domain/goal-progress-series";
import type {
  GoalNode,
  GoalLatestCheckin,
  RelatedEpic,
  RelatedWorkItem,
  ScopeRef,
  GoalCustomFieldEntry,
  ProgressChart,
  ProgressChartPoint,
} from "./ziele-view";

// ── Eingabetypen (vom Loader normalisiert; reines plain-JS, kein Prisma) ──────

/** Ein direkt verknüpftes Epic — Routing/Titel vom Loader, KPIs für den €-Trio. */
export interface ForestRelatedEpic {
  epicId: string;
  title: string;
  stageGate: string;
  href: string;
  kpis: KpiInput[];
  // ── Einheiten-Kaskade (optional; nur bei GoalEpicLink mit gewählter KPI) ──
  /** Gewählte Erfolgs-KPI dieses Links; null/undefined = Alt-€-Link. */
  successKpi?: KpiInput | null;
  /** Ziel-Metrik-Einheit je 1 Einheit der gewählten KPI. */
  conversionFactor?: number | null;
  impactKind?: string;
  recurringInterval?: string;
}

/** Eine normalisierte Objective-Zeile (alle Decimal→number, Date→ISO). */
export interface ForestObjective {
  id: string;
  parentObjectiveId: string | null;
  nodeKind: string;
  title: string;
  narrative: string | null;
  period: string | null;
  status: string | null;
  /** ISO-String oder null. */
  dueDate: string | null;
  ownerId: string | null;
  accountableTeam: ScopeRef | null;
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  rollupWeight: number | null;
  /** Umrechnung eigene Metrik-Einheit → Eltern-Metrik-Einheit (Einheiten-Kaskade). */
  parentUnitPerChildUnit: number | null;
  /** Asana „Remove from automatic progress": false = zählt nicht im Eltern-Rollup. */
  includeInParentRollup: boolean;
  baseline: number | null;
  target: number | null;
  current: number | null;
  formula: string;
  /** Roh-Wert aus der DB (`null` ⇒ abgeleitet); `resolveNode` löst effektiv auf. */
  progressMode: string | null;
}

/** Custom-Field-Definition (tenant-weit). */
export interface ForestCustomFieldDef {
  defId: string;
  name: string;
  type: string;
  options: string[];
}

/** Per-Knoten-Lookups; jede Map ist `objectiveId → …`. */
export interface ForestLookups {
  latestCheckin: ReadonlyMap<string, GoalLatestCheckin>;
  relatedEpics: ReadonlyMap<string, ForestRelatedEpic[]>;
  /** auto_kpi-Ist-Beiträge je Knoten (Faktor bevorzugt, sonst gleiche Einheit). */
  autoKpiLinks: ReadonlyMap<string, AutoKpiLink[]>;
  relatedWork: ReadonlyMap<string, RelatedWorkItem[]>;
  valueStreams: ReadonlyMap<string, ScopeRef[]>;
  arts: ReadonlyMap<string, ScopeRef[]>;
  customFieldDefs: ForestCustomFieldDef[];
  customFieldValues: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

export interface GoalForestInput {
  /** Alle Ziel-Knoten des Tenants (beliebige Reihenfolge; der Loader sortiert). */
  rows: ForestObjective[];
  lookups: ForestLookups;
}

// ── Der Seam: eine Auflösung „Zeile → effektive Fakten" ───────────────────────

/** Die aufgelösten Blatt-Fakten eines Knotens — Grundlage für Baum & Graf. */
export interface ResolvedNode {
  mode: ProgressMode;
  /** Bei `auto_kpi` die einheitengleiche KPI-Summe, sonst der gepflegte `current`. */
  effectiveCurrent: number | null;
  /** Eigener Blatt-Fortschritt 0..1; `null` bei `rollup`. */
  progressLeaf: number | null;
  trioLeaf: RollupTrio;
  trioEpicLinks: RollupTrio;
  /** Eigener Metrik-Wert in EIGENER Einheit (Einheiten-Kaskade). */
  unitValueLeaf: RollupTrio;
  /** Einheiten-Beitrag der verknüpften Epic-Erfolgs-KPIs, in EIGENER Einheit. */
  unitEpicLinks: RollupTrio;
  isMeasurable: boolean;
  relatedEpics: RelatedEpic[];
}

/**
 * **Der Seam.** Löst für einen Knoten die Fortschrittsquelle und alle abgeleiteten
 * Blatt-Fakten (Ist-Wert, progressLeaf, trioLeaf, trioEpicLinks) auf — die eine
 * Stelle, an der `formula==="auto_from_kpi"`, der `rollup ⇒ progressLeaf=null`-
 * Spezialfall und die auto_kpi-Einheitenanpassung leben. Rein, ohne I/O.
 */
export function resolveNode(
  o: ForestObjective,
  ctx: {
    hasChildren: boolean;
    autoKpiLinks: AutoKpiLink[];
    relatedEpics: ForestRelatedEpic[];
  },
): ResolvedNode {
  // Der €-Wert eines Ziels stammt ausschließlich aus verknüpften Epics
  // (`trioEpicLinks`) + Kinder-Rollup; die Eigen-Metrik trägt €0 bei.
  const trioLeaf: RollupTrio = { planned: 0, realized: 0, runRate: 0 };

  const mode = effectiveProgressMode(o.progressMode, ctx.hasChildren);
  const kpiLeaf = derivesCurrentFromKpis(mode, ctx.hasChildren);
  const aggregates = aggregatesFromChildren(mode, ctx.hasChildren);
  const unitSpec = {
    metricUnit: o.metricUnit,
    metricType: o.metricType,
    currencyCode: o.currencyCode,
  };
  const effectiveCurrent = kpiLeaf
    ? autoKpiCurrent({ ...unitSpec, baseline: o.baseline, target: o.target }, ctx.autoKpiLinks)
    : o.current;
  // Aggregierende Knoten (rollup / kpi_tree-Ast) liefern keinen Blatt-Fortschritt;
  // ihr Fortschritt kommt aus `nodeProgress` (Ø) bzw. dem wert-basierten Override.
  const progressLeaf = aggregates
    ? null
    : keyResultProgress({ baseline: o.baseline, target: o.target, current: effectiveCurrent });

  const relatedEpics: RelatedEpic[] = ctx.relatedEpics.map((e) => ({
    epicId: e.epicId,
    title: e.title,
    stageGate: e.stageGate,
    trio: epicLinkTrio([{ epicId: e.epicId, kpis: e.kpis }]),
    href: e.href,
  }));
  const trioEpicLinks = sumTrios(relatedEpics.map((r) => r.trio));

  // Einheiten-Kaskade: eigener Metrik-Wert (in eigener Einheit) + die in die
  // eigene Einheit umgerechneten Beiträge der verknüpften Erfolgs-KPIs.
  const unitValueLeaf: RollupTrio =
    o.baseline !== null && o.target !== null
      ? {
          planned: Math.abs(o.target - o.baseline),
          realized: kpiDelta({ baseline: o.baseline, target: o.target, current: effectiveCurrent }),
          runRate: kpiDelta({ baseline: o.baseline, target: o.target, current: effectiveCurrent }),
        }
      : { planned: 0, realized: 0, runRate: 0 };
  // Bei KPI-getriebenen Blättern (`auto_kpi`, `kpi_tree`-Blatt) fließen die
  // Epic-Erfolgs-KPIs bereits über `effectiveCurrent` in `unitValueLeaf` ein —
  // sie hier NICHT ein zweites Mal addieren (`nodeUnitValue` summiert
  // `unitValueLeaf + unitEpicLinks`). Nur bei manual/rollup ist der Epic-Link-
  // Beitrag eine eigenständige Achse.
  const unitEpicLinks = kpiLeaf
    ? { planned: 0, realized: 0, runRate: 0 }
    : sumTrios(
        ctx.relatedEpics.map((e) =>
          e.successKpi
            ? epicSuccessKpiContribution(
                e.successKpi,
                e.conversionFactor ?? null,
                e.impactKind ?? "recurring",
                e.recurringInterval ?? "yearly",
              )
            : { planned: 0, realized: 0, runRate: 0 },
        ),
      );

  return {
    mode,
    effectiveCurrent,
    progressLeaf,
    trioLeaf,
    trioEpicLinks,
    unitValueLeaf,
    unitEpicLinks,
    isMeasurable: isMeasurableGoal({
      progressMode: mode,
      target: o.target,
      hasChildren: ctx.hasChildren,
    }),
    relatedEpics,
  };
}

// ── buildStrategyTree: der häufige Aufruf ─────────────────────────────────────

/**
 * Reine Baum-Assemblierung: normalisierte Zeilen + Lookups → `{ themes, tenantTrio }`.
 * Baut den Baum über `parentObjectiveId`, löst je Knoten via `resolveNode` auf,
 * rechnet die Rollups über die getesteten `nodeProgress`/`nodeTrio` und setzt den
 * `contributionShare` je Kind während der Assemblierung. **Kein Filter** — Period/
 * VS/ART-Filter bleiben im Loader (`filterGoalBranches` auf dem Ergebnis).
 */
export function buildStrategyTree(input: GoalForestInput): {
  themes: GoalNode[];
  tenantTrio: RollupTrio;
} {
  const { rows, lookups } = input;

  const childrenByParent = new Map<string, ForestObjective[]>();
  const roots: ForestObjective[] = [];
  for (const o of rows) {
    if (o.parentObjectiveId) {
      const arr = childrenByParent.get(o.parentObjectiveId);
      if (arr) arr.push(o);
      else childrenByParent.set(o.parentObjectiveId, [o]);
    } else {
      roots.push(o);
    }
  }

  function build(o: ForestObjective, depth: number): { node: GoalNode; rollup: RollupNode } {
    const childRows = childrenByParent.get(o.id) ?? [];
    const hasChildren = childRows.length > 0;

    const resolved = resolveNode(o, {
      hasChildren,
      autoKpiLinks: lookups.autoKpiLinks.get(o.id) ?? [],
      relatedEpics: lookups.relatedEpics.get(o.id) ?? [],
    });

    const built = childRows.map((c) => build(c, depth + 1));
    const childNodes = built.map((b) => b.node);
    const childRollups = built.map((b) => b.rollup);

    // contributionShare je Kind (Gewicht / Σ Geschwister-Gewichte).
    const childWeights = childNodes.map((c) => c.rollupWeight ?? 1);
    const childWeightSum = childWeights.reduce((s, w) => s + w, 0);
    childNodes.forEach((c, i) => {
      c.contributionShare = childWeightSum > 0 ? (childWeights[i] ?? 1) / childWeightSum : 0;
    });

    const rollup: RollupNode = {
      weight: o.rollupWeight ?? 1,
      includeInRollup: o.includeInParentRollup,
      mode: resolved.mode,
      progressLeaf: resolved.progressLeaf,
      trioLeaf: resolved.trioLeaf,
      trioEpicLinks: resolved.trioEpicLinks,
      children: childRollups,
      unitValueLeaf: resolved.unitValueLeaf,
      unitEpicLinks: resolved.unitEpicLinks,
      childUnitFactor: o.parentUnitPerChildUnit,
    };

    // Wert-basierte Completion: ein `kpi_tree`-**Ast** mit EIGENEM numerischem
    // Zielwert und aktiver Unit-Kaskade (Kinder mit `childUnitFactor`) misst
    // seine Erfüllung magnituden-gewichtet am kaskadierten Wert
    // (`realized / |target − baseline|`) statt am Kinder-Durchschnitt. `rollup`
    // bleibt der einheiten-unabhängige Ø (ADR-0008).
    const unitValue = nodeUnitValue(rollup);
    const ownSpan = o.baseline !== null && o.target !== null ? Math.abs(o.target - o.baseline) : 0;
    const valueBasedRollup =
      usesValueBasedCompletion(resolved.mode, hasChildren) &&
      ownSpan > 0 &&
      childRollups.some((c) => c.childUnitFactor != null);
    const progress = valueBasedRollup
      ? Math.max(0, Math.min(1, unitValue.realized / ownSpan))
      : nodeProgress(rollup);

    const node: GoalNode = {
      id: o.id,
      nodeKind: o.nodeKind,
      title: o.title,
      narrative: o.narrative,
      period: o.period,
      status: o.status,
      dueDate: o.dueDate,
      ownerId: o.ownerId,
      accountableTeam: o.accountableTeam,
      latestCheckin: lookups.latestCheckin.get(o.id) ?? null,
      metricUnit: o.metricUnit,
      metricType: o.metricType,
      precision: o.precision,
      currencyCode: o.currencyCode,
      rollupWeight: o.rollupWeight,
      parentUnitPerChildUnit: o.parentUnitPerChildUnit,
      includeInParentRollup: o.includeInParentRollup,
      contributionShare: 0, // vom Parent gesetzt (Roots bleiben 0)
      baseline: o.baseline,
      target: o.target,
      current: resolved.effectiveCurrent,
      formula: o.formula,
      progressMode: resolved.mode,
      isMeasurable: resolved.isMeasurable,
      relatedEpics: resolved.relatedEpics,
      relatedWork: lookups.relatedWork.get(o.id) ?? [],
      valueStreams: lookups.valueStreams.get(o.id) ?? [],
      arts: lookups.arts.get(o.id) ?? [],
      customFields: lookups.customFieldDefs.map((d) => ({
        defId: d.defId,
        name: d.name,
        type: d.type,
        options: d.options,
        value: lookups.customFieldValues.get(o.id)?.get(d.defId) ?? "",
      })) satisfies GoalCustomFieldEntry[],
      children: childNodes,
      depth,
      progress,
      trio: nodeTrio(rollup),
      unitValue,
    };
    return { node, rollup };
  }

  const themes = roots.map((o) => build(o, 0).node);
  return { themes, tenantTrio: sumTrios(themes.map((t) => t.trio)) };
}

// ── buildProgressChart: der seltenere Folge-Aufruf ────────────────────────────

/** Eine Objective-Zeile im Chart-Subtree (nur die für die Serie nötigen Felder). */
export interface ChartObjective {
  id: string;
  parentObjectiveId: string | null;
  progressMode: string | null;
  baseline: number | null;
  target: number | null;
  current: number | null;
  rollupWeight: number | null;
  metricUnit: string | null;
  metricType: string;
  currencyCode: string | null;
}

/** Eigener Status-/Wert-Check-in des Wurzelknotens (für die Punkte). */
export interface ChartRootCheckin {
  atMs: number;
  status: string | null;
  value: number | null;
  progress: number | null;
}

export interface GoalChartInput {
  rootId: string;
  /** Wurzel + Nachfahren (normalisiert). */
  rows: ChartObjective[];
  /** 0..1-Fortschritts-Snapshots je Knoten (für die rekursive Serie). */
  progressByNode: ReadonlyMap<string, SeriesNode["checkins"]>;
  /** Verknüpfte Epic-KPIs (faktor-bewusst, mit Messreihe) je Knoten — für auto_kpi. */
  autoKpiSeriesByNode: ReadonlyMap<string, SeriesNode["autoKpiLinks"]>;
  /** Eigene Check-ins des Wurzelknotens (Punkte-Quelle). */
  rootCheckins: ChartRootCheckin[];
  /** „Jetzt" als ISO — injizierbar für Tests. */
  now: string;
}

/**
 * Reine Graf-Serie: die Linie folgt der Fortschrittsquelle des Wurzelknotens
 * (KPI-Verlauf / Kinder-Rollup / manuelle Snapshots), die farbigen Punkte sind
 * die eigenen Status-Check-ins. Baut den `SeriesNode`-Baum hinter diesem Seam.
 */
export function buildProgressChart(input: GoalChartInput): ProgressChart {
  const empty: ProgressChart = { mode: "percent", series: [], yDomain: [0, 100] };
  const { rootId, rows, progressByNode, autoKpiSeriesByNode, rootCheckins, now } = input;

  const childrenByParent = new Map<string, ChartObjective[]>();
  for (const r of rows) {
    if (r.parentObjectiveId) {
      const arr = childrenByParent.get(r.parentObjectiveId);
      if (arr) arr.push(r);
      else childrenByParent.set(r.parentObjectiveId, [r]);
    }
  }

  const toSeriesNode = (row: ChartObjective): SeriesNode => {
    const kids = childrenByParent.get(row.id) ?? [];
    return {
      progressMode: effectiveProgressMode(row.progressMode, kids.length > 0),
      baseline: row.baseline,
      target: row.target,
      current: row.current,
      rollupWeight: row.rollupWeight ?? 1,
      unitSpec: {
        metricUnit: row.metricUnit,
        metricType: row.metricType,
        currencyCode: row.currencyCode,
      },
      checkins: progressByNode.get(row.id) ?? [],
      autoKpiLinks: autoKpiSeriesByNode.get(row.id) ?? [],
      children: kids.map(toSeriesNode),
    };
  };

  const rootRow = rows.find((r) => r.id === rootId);
  if (!rootRow) return empty;
  const seriesRoot = toSeriesNode(rootRow);

  const effMode = seriesRoot.progressMode;
  const rootHasChildren = seriesRoot.children.length > 0;
  // Wert-Achse nur für KPI-/Metrik-Blätter mit Zielwert; aggregierende Knoten
  // (rollup, kpi_tree-Ast) fahren die Prozent-Achse (Kinder-Ø).
  const mode: "value" | "percent" =
    !aggregatesFromChildren(effMode, rootHasChildren) && seriesRoot.target != null
      ? "value"
      : "percent";

  const points: ProgressChartPoint[] = [];

  // 1) Kontinuierlicher Verlauf (kein Punkt): KPI-Blatt → KPI-Historie,
  //    aggregierend → Kinder-Ø. (Bei manual liefert Schritt 2 die Linien-Punkte.)
  if (mode === "percent") {
    for (const p of buildNodeProgressSeries(seriesRoot, now)) {
      points.push({ at: Date.parse(p.at), value: p.progress * 100, status: null, entry: false });
    }
  } else if (derivesCurrentFromKpis(effMode, rootHasChildren)) {
    const seriesGoal = {
      ...seriesRoot.unitSpec,
      baseline: seriesRoot.baseline,
      target: seriesRoot.target,
    };
    for (const p of buildAutoKpiSeries(seriesGoal, seriesRoot.autoKpiLinks)) {
      points.push({ at: Date.parse(p.at), value: p.value, status: null, entry: false });
    }
  }

  // 2) Eigene Check-ins: Status gesetzt → farbiger Status-Punkt; statuslos mit
  //    Wert (manueller Eintrag) → neutraler Punkt.
  for (const c of rootCheckins) {
    const v = mode === "value" ? c.value : c.progress != null ? c.progress * 100 : null;
    if (v == null) continue;
    points.push({ at: c.atMs, value: v, status: c.status, entry: c.status == null });
  }

  // 3) manual: Live-Ende (aktueller Ist-Wert @ heute) als Linienknick, kein Punkt.
  if (mode === "value" && effMode === "manual" && seriesRoot.current != null) {
    points.push({ at: Date.parse(now), value: seriesRoot.current, status: null, entry: false });
  }

  // Merge je Zeitpunkt mit Vorrang Status-Punkt > neutraler Eintrag > Linie.
  const rank = (p: ProgressChartPoint): number => (p.status != null ? 2 : p.entry ? 1 : 0);
  const byAt = new Map<number, ProgressChartPoint>();
  for (const p of points) {
    const ex = byAt.get(p.at);
    if (!ex || rank(p) >= rank(ex)) byAt.set(p.at, p);
  }
  const series = [...byAt.values()].sort((a, b) => a.at - b.at);

  let yDomain: [number, number];
  if (mode === "percent") {
    yDomain = [0, 100];
  } else {
    const vals = series.map((s) => s.value);
    const anchors = [seriesRoot.baseline ?? 0, seriesRoot.target ?? 0, ...vals];
    const lo = Math.min(...anchors);
    const hi = Math.max(...anchors);
    yDomain = [lo, hi > lo ? hi : lo + 1];
  }

  return { mode, series, yDomain };
}
