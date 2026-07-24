import type { PrismaClient } from "@/generated/prisma";
import {
  keyResultTrio,
  keyResultProgress,
  kpiContributionDetail,
  epicLinkTrio,
  sumTrios,
  nodeProgress,
  nodeTrio,
  type KpiInput,
  type KrContributionInput,
  type RollupTrio,
  type RollupNode,
} from "@/domain/goals-rollup";
import { parseOptions } from "@/domain/goal-custom-field";
import {
  effectiveProgressMode,
  autoKpiCurrent,
  isMeasurableGoal,
  type ProgressMode,
} from "@/domain/goal-progress-mode";
import { parseMeasurements, latestMeasurement } from "@/domain/kpi-measurement";
import {
  buildAutoKpiSeries,
  buildNodeProgressSeries,
  type SeriesNode,
} from "@/domain/goal-progress-series";

/**
 * Ziele-/Strategie-/KPI-Coverage Loader. Zwei page-models leben hier:
 *
 *  - `loadStrategyTree(db, tenantId, { period? })` — die Theme→KR-
 *    Hierarchie mit €-Trios pro Ebene. Konsumenten: `/ziele`-Shell
 *    (read-only), `/strategy`-Shell (edit).
 *  - `loadKpiInventory(db, tenantId, tree)` — KPI-Bibliothek mit
 *    Pyramid-Bindungen + KR-Index fuer die KPI-Coverage-Tabelle.
 *
 * Ein Page-Model fasst Page-spezifische Daten zusammen — `permissions`
 * und der UI-`tab` leben deshalb in der Page, nicht im Loader.
 * CONTEXT.md §Page-model.
 */

export type ZieleSubTab = "strategie" | "okrs" | "money" | "pflege";

export interface ZieleKrContribution {
  kpiId: string;
  kpiName: string;
  epicTitle: string;
  weight: number;
  valuePerUnitOverride: number | null;
  /** Achievement-Anteil 0..1 zum Anzeigen im Picker (current vs. target). */
  achievement: number | null;
  /** € Beitrag dieses KPI zum KR (Realized). */
  contributionRealized: number;
}

/** Der letzte Status-Check-in eines Ziels — backt Pill + „vor X Tagen". */
export interface GoalLatestCheckin {
  status: string;
  at: string;
}

/**
 * Ein direkt an einen Ziel-Knoten verknüpftes Epic ("Related work"). Rein
 * referenziell (Deeplink) plus wertbringend: `trio` ist der €-Beitrag aus den
 * KPIs des Epics, der bereits im Knoten-`trio` mit aufsummiert ist.
 */
export interface RelatedEpic {
  epicId: string;
  title: string;
  stageGate: string;
  trio: RollupTrio;
  href: string;
}

/**
 * Rein referenzielle Related-Work-Verknüpfung (Feature/PI) — kein €-Beitrag,
 * nur ein Deeplink. Epics laufen wertbringend über {@link RelatedEpic}.
 */
export interface RelatedWorkItem {
  /** "feature" | "pi". */
  kind: string;
  refId: string;
  title: string;
  href: string;
}

/** VS-/ART-Verantwortungs-Referenz an einem Ziel (Epic 6a). */
export interface ScopeRef {
  id: string;
  name: string;
}

/** Ein Custom Field mit seinem (evtl. leeren) Wert an einem Ziel-Knoten. */
export interface GoalCustomFieldEntry {
  defId: string;
  name: string;
  /** "text" | "number" | "select". */
  type: string;
  options: string[];
  value: string;
}

/**
 * **Goal-Knoten** — der eine, rekursive Knotentyp nach der Kaskaden-
 * Vereinheitlichung (Objective + Key Result verschmolzen). `nodeKind`
 * unterscheidet nur das Label; jeder Knoten kann `children` UND/ODER eine
 * eigene Metrik tragen. Top-Level-Knoten sind die „Themes" unter dem Tenant.
 */
export interface GoalNode {
  id: string;
  /** "objective" | "key_result" — rein Label-unterscheidend. */
  nodeKind: string;
  title: string;
  narrative: string | null;
  /** Zeitraum, kanonisch YYYY-Qn | YYYY-Hn | YYYY (goal-period) oder null. */
  period: string | null;
  confidence: number | null;
  /** Persistierter Goal-Status (src/domain/goal-status.ts) oder null. */
  status: string | null;
  dueDate: string | null;
  ownerId: string | null;
  latestCheckin: GoalLatestCheckin | null;
  // ── Metrik (nur bei messbaren Blättern relevant) ──
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  /** Relatives Gewicht im Eltern-Rollup (Epic 3); null = Default 1. */
  rollupWeight: number | null;
  /** Normalisierter Beitrag 0..1 (= Gewicht / Σ Geschwister-Gewichte). */
  contributionShare: number;
  baseline: number | null;
  target: number | null;
  /** Ist-Wert; bei `progressMode = "auto_kpi"` die abgeleitete Summe. */
  current: number | null;
  formula: string;
  /** Fortschrittsquelle (effektiv aufgelöst): manual | rollup | auto_kpi. */
  progressMode: ProgressMode;
  /** Ob der Knoten einen 0..1-Fortschritt liefern kann (für Board/Filter). */
  isMeasurable: boolean;
  /** Wie viele KPIs an diesen Knoten gebunden sind. */
  kpiCount: number;
  /** Gebundene KPIs inkl. Weight + €-Beitrag (KPI-Tab). */
  contributions: ZieleKrContribution[];
  /** Direkt verknüpfte Epics ("Related work"); ihr € ist im `trio` enthalten. */
  relatedEpics: RelatedEpic[];
  /** Referenziell verknüpfte Features/PIs (kein €-Beitrag, nur Deeplink). */
  relatedWork: RelatedWorkItem[];
  /** VS-Verantwortung (Epic 6a, n:m) — rein organisatorisch. */
  valueStreams: ScopeRef[];
  /** ART-Verantwortung (Epic 6a, n:m). */
  arts: ScopeRef[];
  /** Tenant-Custom-Fields mit dem Wert an diesem Knoten (leer wenn ungesetzt). */
  customFields: GoalCustomFieldEntry[];
  // ── Rekursion + Rollup ──
  /** Kind-Knoten (Sub-Objectives / Key Results), beliebig tief. */
  children: GoalNode[];
  /** Tiefe im Baum (0 = Top-Level). */
  depth: number;
  /** Completion 0..1 = rekursiver (gewichteter) Ø; `null` wenn nicht messbar. */
  progress: number | null;
  trio: RollupTrio;
}

/** Alt-Namen als Aliase — beide zeigen jetzt auf den einen Goal-Knoten. */
export type ZieleTreeKeyResult = GoalNode;
export type ZieleTreeTheme = GoalNode;

export interface ZieleKpiLibraryEntry {
  id: string;
  name: string;
  unit: string | null;
  valuePerUnit: number | null;
  epicId: string;
  epicTitle: string;
  /** Pyramid-Invariante: maximal eine Bindung pro KPI. */
  binding: {
    keyResultId: string;
    keyResultTitle: string;
    themeTitle: string;
    weight: number;
    valuePerUnitOverride: number | null;
    contributionRealized: number;
  } | null;
}

export interface ZieleKrLibraryEntry {
  id: string;
  title: string;
  themeId: string;
  themeTitle: string;
}

export interface ZielePermissions {
  /** Strategie + OKRs editieren (LPM-Surface). */
  canEditStrategy: boolean;
  /** Finance-Controller: KPI valuePerUnit + KR-KPI-Bindung pflegen. */
  canEditKpiValuation: boolean;
}

export interface StrategyTree {
  /** Top-Level-Goal-Knoten (die „Themes"); je Knoten `children` beliebig tief. */
  themes: GoalNode[];
  /** Tenant-Gesamt-Rollup (Summe ueber alle Top-Level-Knoten). */
  tenantTrio: RollupTrio;
  /** Period-Filter (z. B. „2026-Q2") oder `null` fuer „Alle". */
  period: string | null;
  /** Aktiver VS-Filter oder `null`. */
  valueStreamId: string | null;
  /** Aktiver ART-Filter oder `null`. */
  artId: string | null;
}

export interface KpiInventory {
  kpiLibrary: ZieleKpiLibraryEntry[];
  krLibrary: ZieleKrLibraryEntry[];
}

/**
 * Composite-Modell, das die Ziele/Strategy-Shell konsumiert. Das Modell
 * wird in der Page zusammengesetzt — der Loader liefert nur den
 * Strategy-Tree; tab/permissions/Inventory kommen von oben dazu.
 */
export interface ZieleModel extends StrategyTree, ZieleSubTabState {
  permissions: ZielePermissions;
  kpiLibrary: ZieleKpiLibraryEntry[];
  krLibrary: ZieleKrLibraryEntry[];
}

interface ZieleSubTabState {
  tab: ZieleSubTab;
}

export async function loadStrategyTree(
  db: PrismaClient,
  tenantId: string,
  input: {
    period?: string | undefined;
    valueStreamId?: string | undefined;
    artId?: string | undefined;
  } = {},
): Promise<StrategyTree> {
  const period = input.period ?? null;
  const filterValueStreamId = input.valueStreamId ?? null;
  const filterArtId = input.artId ?? null;

  // Alle Goal-Knoten des Tenants flach laden (Objective = einziger Knotentyp).
  // Der Baum wird in JS über parentObjectiveId gebaut; kein rekursiver Include.
  const objectiveRows = await db.objective.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      kpiContributions: {
        include: {
          kpi: {
            select: {
              id: true,
              name: true,
              baseline: true,
              target: true,
              measurements: true,
              valuePerUnit: true,
              initiative: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  const nodeIds = objectiveRows.map((o) => o.id);

  // Letzter Status-Check-in je Knoten (eine Query; alle Knoten sind Objectives).
  const latestByNode = new Map<string, GoalLatestCheckin>();
  if (nodeIds.length > 0) {
    const checkins = await db.goalCheckin.findMany({
      where: { tenantId, status: { not: null }, objectiveId: { in: nodeIds } },
      orderBy: { createdAt: "desc" },
      select: { objectiveId: true, status: true, createdAt: true },
    });
    for (const c of checkins) {
      if (c.status == null || !c.objectiveId) continue;
      if (!latestByNode.has(c.objectiveId)) {
        latestByNode.set(c.objectiveId, { status: c.status, at: c.createdAt.toISOString() });
      }
    }
  }

  // "Related work": verknüpfte Epics je Knoten — EINE Query (kein N+1),
  // soft-gelöschte Epics ausgeblendet. €-Beitrag aus den Epic-KPIs. `unit` wird
  // zusätzlich geladen für die einheitengleiche Fortschritts-Ableitung (auto_kpi).
  const relatedByNode = new Map<string, RelatedEpic[]>();
  const epicKpisByNode = new Map<string, { unit: string | null; current: number | null }[]>();
  if (nodeIds.length > 0) {
    const epicLinks = await db.goalEpicLink.findMany({
      where: { tenantId, epic: { deletedAt: null }, objectiveId: { in: nodeIds } },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
            stageGate: true,
            kpis: {
              select: {
                id: true,
                unit: true,
                baseline: true,
                target: true,
                measurements: true,
                valuePerUnit: true,
              },
            },
          },
        },
      },
    });
    for (const link of epicLinks) {
      if (!link.objectiveId) continue;
      const kpis: KpiInput[] = link.epic.kpis.map((k) => ({
        id: k.id,
        baseline: toFloat(k.baseline),
        target: toFloat(k.target),
        current: latestMeasurement(k.measurements),
        valuePerUnit: toFloat(k.valuePerUnit),
      }));
      const related: RelatedEpic = {
        epicId: link.epic.id,
        title: link.epic.title,
        stageGate: link.epic.stageGate,
        trio: epicLinkTrio([{ epicId: link.epic.id, kpis }]),
        href: `/portfolio/epics/${link.epic.id}`,
      };
      (relatedByNode.get(link.objectiveId) ?? setAndGet(relatedByNode, link.objectiveId)).push(
        related,
      );
      const kpiUnits =
        epicKpisByNode.get(link.objectiveId) ?? setAndGet(epicKpisByNode, link.objectiveId);
      for (const k of link.epic.kpis) {
        kpiUnits.push({ unit: k.unit, current: latestMeasurement(k.measurements) });
      }
    }
  }

  // Related work (referenziell): Feature/PI je Knoten. EINE Link-Query, dann
  // je Kind EINE Titel-Auflösung (Initiative/ProgramIncrement) — kein N+1.
  const relatedWorkByNode = new Map<string, RelatedWorkItem[]>();
  if (nodeIds.length > 0) {
    const links = await db.goalRelatedWork.findMany({
      where: { tenantId, objectiveId: { in: nodeIds } },
      select: { objectiveId: true, kind: true, refId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (links.length > 0) {
      const featureIds = [
        ...new Set(links.filter((l) => l.kind === "feature").map((l) => l.refId)),
      ];
      const piIds = [...new Set(links.filter((l) => l.kind === "pi").map((l) => l.refId))];
      const [features, pis] = await Promise.all([
        featureIds.length > 0
          ? db.initiative.findMany({
              where: { tenantId, id: { in: featureIds }, deletedAt: null },
              select: { id: true, title: true, parentId: true },
            })
          : Promise.resolve([]),
        piIds.length > 0
          ? db.programIncrement.findMany({
              where: { tenantId, id: { in: piIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ]);
      const featureById = new Map(features.map((f) => [f.id, f]));
      const piName = new Map(pis.map((p) => [p.id, p.name]));
      for (const l of links) {
        if (l.kind === "feature") {
          const f = featureById.get(l.refId);
          // Feature hat keine eigene Route — Deeplink zeigt den Feature-Slide-Over
          // im Eltern-Epic; ohne Eltern-Epic auf die Feature-Liste ausweichen.
          const href = f?.parentId
            ? `/portfolio/epics/${f.parentId}?featureId=${l.refId}`
            : `/implementation/features`;
          (
            relatedWorkByNode.get(l.objectiveId) ?? setAndGet(relatedWorkByNode, l.objectiveId)
          ).push({ kind: l.kind, refId: l.refId, title: f?.title ?? "(gelöscht)", href });
        } else {
          (
            relatedWorkByNode.get(l.objectiveId) ?? setAndGet(relatedWorkByNode, l.objectiveId)
          ).push({
            kind: l.kind,
            refId: l.refId,
            title: piName.get(l.refId) ?? "(gelöscht)",
            href: `/pi/${l.refId}`,
          });
        }
      }
    }
  }

  // VS/ART-Verantwortung (Epic 6a): je zwei Batch-Queries mit Namen (kein N+1).
  const valueStreamsByNode = new Map<string, ScopeRef[]>();
  const artsByNode = new Map<string, ScopeRef[]>();
  if (nodeIds.length > 0) {
    const [vsLinks, artLinks] = await Promise.all([
      db.goalValueStreamLink.findMany({
        where: { tenantId, objectiveId: { in: nodeIds } },
        select: { objectiveId: true, valueStream: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.goalArtLink.findMany({
        where: { tenantId, objectiveId: { in: nodeIds } },
        select: { objectiveId: true, art: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    for (const l of vsLinks) {
      (valueStreamsByNode.get(l.objectiveId) ?? setAndGet(valueStreamsByNode, l.objectiveId)).push({
        id: l.valueStream.id,
        name: l.valueStream.name,
      });
    }
    for (const l of artLinks) {
      (artsByNode.get(l.objectiveId) ?? setAndGet(artsByNode, l.objectiveId)).push({
        id: l.art.id,
        name: l.art.name,
      });
    }
  }

  // Custom Fields: Tenant-Defs einmal + alle Werte über die Knoten-IDs in je
  // einer Query (kein N+1). Je Knoten werden ALLE Defs mit ihrem Wert gezeigt.
  const customFieldDefs = await db.goalCustomFieldDef.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, type: true, options: true },
  });
  const valueByNode = new Map<string, Map<string, string>>();
  if (customFieldDefs.length > 0 && nodeIds.length > 0) {
    const values = await db.goalCustomFieldValue.findMany({
      where: { tenantId, objectiveId: { in: nodeIds } },
      select: { objectiveId: true, defId: true, value: true },
    });
    for (const v of values) {
      let m = valueByNode.get(v.objectiveId);
      if (!m) {
        m = new Map();
        valueByNode.set(v.objectiveId, m);
      }
      m.set(v.defId, v.value);
    }
  }
  const parsedDefs = customFieldDefs.map((d) => ({
    defId: d.id,
    name: d.name,
    type: d.type,
    options: parseOptions(d.options),
  }));

  // Kinder je Parent (in Load-Reihenfolge = sortOrder, createdAt).
  const childrenByParent = new Map<string, typeof objectiveRows>();
  const roots: typeof objectiveRows = [];
  for (const o of objectiveRows) {
    if (o.parentObjectiveId) {
      (
        childrenByParent.get(o.parentObjectiveId) ??
        setAndGet(childrenByParent, o.parentObjectiveId)
      ).push(o);
    } else {
      roots.push(o);
    }
  }

  type Row = (typeof objectiveRows)[number];

  // Rekursiver Aufbau: liefert GoalNode + parallelen RollupNode für die
  // (getesteten) Domain-Rollups nodeProgress/nodeTrio.
  function build(o: Row, depth: number): { node: GoalNode; rollup: RollupNode } {
    const relatedEpics = relatedByNode.get(o.id) ?? [];
    // relatedEpics tragen bereits fertige Trios (im Batch gerechnet) → summieren.
    const epicTrio = sumTrios(relatedEpics.map((r) => r.trio));

    const kpisById = new Map<string, KpiInput>();
    for (const c of o.kpiContributions) {
      kpisById.set(c.kpi.id, {
        id: c.kpi.id,
        baseline: toFloat(c.kpi.baseline),
        target: toFloat(c.kpi.target),
        current: latestMeasurement(c.kpi.measurements),
        valuePerUnit: toFloat(c.kpi.valuePerUnit),
      });
    }
    const contributions: KrContributionInput[] = o.kpiContributions.map((c) => ({
      kpiId: c.kpiId,
      weight: Number(c.weight),
      valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
    }));
    const trioLeaf =
      o.formula === "auto_from_kpi" ? keyResultTrio(contributions, kpisById) : manualKrTrio();

    const childRows = childrenByParent.get(o.id) ?? [];
    const hasChildren = childRows.length > 0;

    // Fortschrittsquelle (goal-progress-mode.ts). null in der DB ⇒ abgeleitet.
    const mode = effectiveProgressMode(o.progressMode, hasChildren);
    const unitSpec = {
      metricUnit: o.metricUnit,
      metricType: o.metricType,
      currencyCode: o.currencyCode,
    };
    // Für auto_kpi ist der Ist-Wert die Summe der einheitengleichen KPIs aus den
    // verknüpften Epics; sonst der manuell gepflegte `current`.
    const effectiveCurrent =
      mode === "auto_kpi"
        ? autoKpiCurrent(unitSpec, epicKpisByNode.get(o.id) ?? [])
        : toFloat(o.current);
    // rollup ⇒ Fortschritt kommt aus den Kindern (progressLeaf irrelevant).
    const progressLeaf =
      mode === "rollup"
        ? null
        : keyResultProgress({
            baseline: toFloat(o.baseline),
            target: toFloat(o.target),
            current: effectiveCurrent,
          });

    const contributionDetails: ZieleKrContribution[] = o.kpiContributions.map((c) => {
      const detail = kpiContributionDetail(kpisById.get(c.kpiId), {
        kpiId: c.kpiId,
        weight: Number(c.weight),
        valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
      });
      return {
        kpiId: c.kpiId,
        kpiName: c.kpi.name,
        epicTitle: c.kpi.initiative.title,
        weight: Number(c.weight),
        valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
        achievement: detail.achievement,
        contributionRealized: detail.contributionRealized,
      };
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
      weight: toFloat(o.rollupWeight) ?? 1,
      mode,
      progressLeaf,
      trioLeaf,
      trioEpicLinks: epicTrio,
      children: childRollups,
    };

    const node: GoalNode = {
      id: o.id,
      nodeKind: o.nodeKind,
      title: o.title,
      narrative: o.narrative,
      period: o.period,
      confidence: o.confidence,
      status: o.status,
      dueDate: o.dueDate ? o.dueDate.toISOString() : null,
      ownerId: o.ownerId,
      latestCheckin: latestByNode.get(o.id) ?? null,
      metricUnit: o.metricUnit,
      metricType: o.metricType,
      precision: o.precision,
      currencyCode: o.currencyCode,
      rollupWeight: toFloat(o.rollupWeight),
      contributionShare: 0, // vom Parent gesetzt (Roots bleiben 0)
      baseline: toFloat(o.baseline),
      target: toFloat(o.target),
      // auto_kpi zeigt den abgeleiteten Summen-Ist; sonst der gepflegte Wert.
      current: effectiveCurrent,
      formula: o.formula,
      progressMode: mode,
      isMeasurable: isMeasurableGoal({
        progressMode: mode,
        target: toFloat(o.target),
        hasChildren,
      }),
      kpiCount: o.kpiContributions.length,
      contributions: contributionDetails,
      relatedEpics,
      relatedWork: relatedWorkByNode.get(o.id) ?? [],
      valueStreams: valueStreamsByNode.get(o.id) ?? [],
      arts: artsByNode.get(o.id) ?? [],
      customFields: parsedDefs.map((d) => ({
        ...d,
        value: valueByNode.get(o.id)?.get(d.defId) ?? "",
      })),
      children: childNodes,
      depth,
      progress: nodeProgress(rollup),
      trio: nodeTrio(rollup),
    };
    return { node, rollup };
  }

  let topLevel = roots.map((o) => build(o, 0).node);
  // Period-/VS-/ART-Filter greifen auf Top-Level-Knoten (Subtrees bleiben
  // vollständig — die Verantwortung hängt am Top-Level-Ziel).
  if (period) topLevel = topLevel.filter((n) => n.period === period);
  if (filterValueStreamId) {
    topLevel = topLevel.filter((n) => n.valueStreams.some((v) => v.id === filterValueStreamId));
  }
  if (filterArtId) {
    topLevel = topLevel.filter((n) => n.arts.some((a) => a.id === filterArtId));
  }

  return {
    themes: topLevel,
    tenantTrio: sumTrios(topLevel.map((t) => t.trio)),
    period,
    valueStreamId: filterValueStreamId,
    artId: filterArtId,
  };
}

/**
 * KPI-Coverage Page-Model. Nimmt den schon geladenen Strategy-Tree
 * mit, damit Theme/KR-Titles + KPI-Beitraege ohne zweiten Roundtrip
 * aufgeloest werden.
 */
export async function loadKpiInventory(
  db: PrismaClient,
  tenantId: string,
  tree: StrategyTree,
): Promise<KpiInventory> {
  const kpiRows = await db.kpi.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      unit: true,
      valuePerUnit: true,
      initiative: { select: { id: true, title: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  // Flach über alle Knoten jeder Tiefe, mit ihrem Top-Level-Vorfahren.
  const allNodes: Array<{ node: GoalNode; root: GoalNode }> = [];
  const walk = (n: GoalNode, root: GoalNode): void => {
    allNodes.push({ node: n, root });
    for (const c of n.children) walk(c, root);
  };
  for (const t of tree.themes) walk(t, t);

  type KrLookup = { title: string; themeId: string; themeTitle: string };
  const krLookup = new Map<string, KrLookup>();
  for (const { node, root } of allNodes) {
    krLookup.set(node.id, { title: node.title, themeId: root.id, themeTitle: root.title });
  }

  type BindingDetail = {
    keyResultId: string;
    weight: number;
    valuePerUnitOverride: number | null;
    contributionRealized: number;
  };
  const bindingByKpiId = new Map<string, BindingDetail>();
  for (const { node } of allNodes) {
    for (const c of node.contributions) {
      if (!bindingByKpiId.has(c.kpiId)) {
        bindingByKpiId.set(c.kpiId, {
          keyResultId: node.id,
          weight: c.weight,
          valuePerUnitOverride: c.valuePerUnitOverride,
          contributionRealized: c.contributionRealized,
        });
      }
    }
  }

  const kpiLibrary: ZieleKpiLibraryEntry[] = kpiRows.map((k) => {
    const b = bindingByKpiId.get(k.id);
    const krInfo = b ? krLookup.get(b.keyResultId) : null;
    return {
      id: k.id,
      name: k.name,
      unit: k.unit,
      valuePerUnit: toFloat(k.valuePerUnit),
      epicId: k.initiative.id,
      epicTitle: k.initiative.title,
      binding:
        b && krInfo
          ? {
              keyResultId: b.keyResultId,
              keyResultTitle: krInfo.title,
              themeTitle: krInfo.themeTitle,
              weight: b.weight,
              valuePerUnitOverride: b.valuePerUnitOverride,
              contributionRealized: b.contributionRealized,
            }
          : null,
    };
  });

  // KR-Bibliothek für die KPI-Coverage: alle messbaren metrik-tragenden Knoten
  // (eigene Metrik, kein reiner Rollup-Container), mit Top-Level-Theme als Gruppe.
  const krLibrary: ZieleKrLibraryEntry[] = [];
  for (const { node, root } of allNodes) {
    if (node.isMeasurable && node.progressMode !== "rollup") {
      krLibrary.push({ id: node.id, title: node.title, themeId: root.id, themeTitle: root.title });
    }
  }
  krLibrary.sort(
    (a, b) => a.themeTitle.localeCompare(b.themeTitle) || a.title.localeCompare(b.title),
  );

  return { kpiLibrary, krLibrary };
}

// ── Goal detail (Drawer) ────────────────────────────────────────────────

export type GoalTarget = "objective" | "kr";

/** One block of a structured status update (Epic 4). */
export interface GoalUpdateSection {
  title: string;
  body: string;
}

export interface GoalCheckinEntry {
  id: string;
  /** Null = pure progress update (no status event). */
  status: string | null;
  /** Raw KR value at that point (metric units); null for objectives. */
  value: number | null;
  /** Normalised 0..1 snapshot. */
  progress: number | null;
  note: string | null;
  /** Structured update sections; null for legacy note-only check-ins. */
  sections: GoalUpdateSection[] | null;
  at: string;
  by: string;
}

export interface GoalCommentEntry {
  id: string;
  body: string;
  at: string;
  by: string;
}

export interface GoalActivityEntry {
  id: string;
  /** audit action, or synthetic `goal.checkin` / `goal.comment` / `goal.progress`. */
  action: string;
  at: string;
  by?: string;
  /** Free-text (check-in note or comment body). */
  comment?: string;
  /** Context, e.g. the check-in status label. */
  detail?: string;
  /** Structured status-update sections (Epic 4), when present. */
  sections?: GoalUpdateSection[];
}

/**
 * Ein Punkt der Graf-Serie: `value` speist die Linie (Roh-Wert oder %), `status`
 * (falls gesetzt) macht ihn zum farbigen Status-Punkt. `at` ist Epoch-ms für die
 * Zeit-X-Achse.
 */
export interface ProgressChartPoint {
  at: number;
  value: number;
  /** Gesetzt ⇒ farbiger Status-Punkt. */
  status: string | null;
  /** true ⇒ diskreter manueller Wert-Eintrag ⇒ neutraler Punkt. */
  entry: boolean;
}

export interface ProgressChart {
  /** "value" = Roh-Wert (messbar); "percent" = 0..100 (Rollup). */
  mode: "value" | "percent";
  series: ProgressChartPoint[];
  yDomain: [number, number];
}

export interface GoalDetail {
  /** Chronological (ascending) check-ins — backs the activity feed. */
  checkins: GoalCheckinEntry[];
  comments: GoalCommentEntry[];
  /** Merged feed (audit + check-ins + comments), newest first. */
  activity: GoalActivityEntry[];
  /** Graf-Serie: Linie folgt der Fortschrittsquelle, Punkte = Status-Updates. */
  progressChart: ProgressChart;
}

/**
 * Full detail bundle for a single goal (Objective or Key Result) — loaded
 * on demand when the drawer opens. Keeps the list loader lean.
 */
export async function loadGoalDetail(
  db: PrismaClient,
  tenantId: string,
  _target: GoalTarget,
  id: string,
): Promise<GoalDetail> {
  // Nach der Knoten-Vereinheitlichung ist jeder Ziel-Knoten ein Objective;
  // Check-ins/Kommentare hängen alle an `objectiveId`. Audit-Historie umfasst
  // sowohl neue `objective`- als auch historische `key_result`-Events dieser id.
  const where = { tenantId, objectiveId: id };

  const [checkinRows, commentRows, auditRows] = await Promise.all([
    db.goalCheckin.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.goalComment.findMany({ where, orderBy: { createdAt: "desc" } }),
    db.auditEvent.findMany({
      where: { tenantId, resourceType: { in: ["objective", "key_result"] }, resourceId: id },
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
  ]);

  const checkins: GoalCheckinEntry[] = checkinRows.map((c) => ({
    id: c.id,
    status: c.status,
    value: toFloat(c.value),
    progress: toFloat(c.progress),
    note: c.note,
    sections: parseSections(c.sections),
    at: c.createdAt.toISOString(),
    by: c.createdBy,
  }));

  const comments: GoalCommentEntry[] = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    at: c.createdAt.toISOString(),
    by: c.createdBy,
  }));

  // Merge into one feed. Check-ins and comments carry their own text; audit
  // events are generic action lines (created/updated/…).
  const activity: GoalActivityEntry[] = [
    // Status-Check-ins vs. reine Progress-Updates (status = null).
    ...checkinRows.map((c) => {
      const sections = parseSections(c.sections);
      return {
        id: `checkin-${c.id}`,
        action: c.status != null ? "goal.checkin" : "goal.progress",
        at: c.createdAt.toISOString(),
        by: c.createdBy,
        comment: c.note ?? undefined,
        detail: c.status ?? (c.value != null ? `→ ${Number(c.value)}` : undefined),
        ...(sections ? { sections } : {}),
      };
    }),
    ...commentRows.map((c) => ({
      id: `comment-${c.id}`,
      action: "goal.comment",
      at: c.createdAt.toISOString(),
      by: c.createdBy,
      comment: c.body,
    })),
    ...auditRows.map((a) => ({
      id: a.id,
      action: a.action,
      at: a.occurredAt.toISOString(),
      by: a.actorId ?? undefined,
    })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  const progressChart = await buildProgressChart(db, tenantId, id);

  return { checkins, comments, activity, progressChart };
}

/**
 * Baut die Graf-Serie: die Linie folgt der Fortschrittsquelle des Knotens
 * (KPI-Verlauf / Rollup der Unterziele / manuelle Snapshots), die farbigen
 * Punkte sind die eigenen Status-Check-ins. Lädt dafür den Subtree (Nachfahren
 * über den `path`-Präfix) samt Check-ins und verknüpften Epic-KPIs.
 */
async function buildProgressChart(
  db: PrismaClient,
  tenantId: string,
  id: string,
): Promise<ProgressChart> {
  const root = await db.objective.findFirst({
    where: { id, tenantId },
    select: { id: true, path: true, target: true, progressMode: true },
  });
  const empty: ProgressChart = { mode: "percent", series: [], yDomain: [0, 100] };
  if (!root) return empty;

  const subtreeRows = await db.objective.findMany({
    where: { tenantId, OR: [{ id }, { path: { startsWith: `${root.path}/` } }] },
    select: {
      id: true,
      parentObjectiveId: true,
      progressMode: true,
      baseline: true,
      target: true,
      current: true,
      rollupWeight: true,
      metricUnit: true,
      metricType: true,
      currencyCode: true,
    },
  });
  const ids = subtreeRows.map((r) => r.id);

  const [checkinAll, epicLinks] = await Promise.all([
    // Alle Check-ins (auch statuslose Wert-Einträge) — die Linie/Kinder-Serien
    // brauchen den `progress`, die neutralen Punkte den statuslosen `value`.
    db.goalCheckin.findMany({
      where: { tenantId, objectiveId: { in: ids } },
      select: { objectiveId: true, status: true, value: true, progress: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.goalEpicLink.findMany({
      where: { tenantId, objectiveId: { in: ids }, epic: { deletedAt: null } },
      select: {
        objectiveId: true,
        epic: { select: { kpis: { select: { unit: true, measurements: true } } } },
      },
    }),
  ]);

  // Fortschritt (0..1) je Knoten für die rekursive Serie.
  const checkinsByNode = new Map<string, { at: string; progress: number }[]>();
  for (const c of checkinAll) {
    if (!c.objectiveId || c.progress == null) continue;
    (checkinsByNode.get(c.objectiveId) ?? setAndGet(checkinsByNode, c.objectiveId)).push({
      at: c.createdAt.toISOString(),
      progress: Number(c.progress),
    });
  }
  const kpisByNode = new Map<
    string,
    { unit: string | null; measurements: ReturnType<typeof parseMeasurements> }[]
  >();
  for (const l of epicLinks) {
    if (!l.objectiveId) continue;
    const arr = kpisByNode.get(l.objectiveId) ?? setAndGet(kpisByNode, l.objectiveId);
    for (const k of l.epic.kpis)
      arr.push({ unit: k.unit, measurements: parseMeasurements(k.measurements) });
  }
  const childrenByParent = new Map<string, typeof subtreeRows>();
  for (const r of subtreeRows) {
    if (r.parentObjectiveId) {
      (
        childrenByParent.get(r.parentObjectiveId) ??
        setAndGet(childrenByParent, r.parentObjectiveId)
      ).push(r);
    }
  }

  type Row = (typeof subtreeRows)[number];
  const toSeriesNode = (row: Row): SeriesNode => {
    const kids = childrenByParent.get(row.id) ?? [];
    return {
      progressMode: effectiveProgressMode(row.progressMode, kids.length > 0),
      baseline: toFloat(row.baseline),
      target: toFloat(row.target),
      current: toFloat(row.current),
      rollupWeight: toFloat(row.rollupWeight) ?? 1,
      unitSpec: {
        metricUnit: row.metricUnit,
        metricType: row.metricType,
        currencyCode: row.currencyCode,
      },
      checkins: checkinsByNode.get(row.id) ?? [],
      kpis: kpisByNode.get(row.id) ?? [],
      children: kids.map(toSeriesNode),
    };
  };
  const rootRow = subtreeRows.find((r) => r.id === id);
  if (!rootRow) return empty;
  const seriesRoot = toSeriesNode(rootRow);

  const nowIso = new Date().toISOString();
  const effMode = seriesRoot.progressMode;
  const mode: "value" | "percent" =
    effMode !== "rollup" && seriesRoot.target != null ? "value" : "percent";

  const points: ProgressChartPoint[] = [];

  // 1) Kontinuierlicher Verlauf (kein Punkt): auto_kpi → KPI-Historie, rollup →
  //    aggregierter Kinder-Ø. (Bei manual liefert Schritt 2 die Linien-Punkte.)
  if (mode === "percent") {
    for (const p of buildNodeProgressSeries(seriesRoot, nowIso)) {
      points.push({ at: Date.parse(p.at), value: p.progress * 100, status: null, entry: false });
    }
  } else if (effMode === "auto_kpi") {
    for (const p of buildAutoKpiSeries(seriesRoot.unitSpec, seriesRoot.kpis)) {
      points.push({ at: Date.parse(p.at), value: p.value, status: null, entry: false });
    }
  }

  // 2) Eigene Check-ins: Status gesetzt → farbiger Status-Punkt; statuslos mit
  //    Wert (manueller Eintrag) → neutraler Punkt.
  for (const c of checkinAll) {
    if (c.objectiveId !== id) continue;
    const v =
      mode === "value" ? toFloat(c.value) : c.progress != null ? Number(c.progress) * 100 : null;
    if (v == null) continue;
    points.push({ at: c.createdAt.getTime(), value: v, status: c.status, entry: c.status == null });
  }

  // 3) manual: Live-Ende (aktueller Ist-Wert @ heute) als Linienknick, kein Punkt.
  if (mode === "value" && effMode === "manual" && seriesRoot.current != null) {
    points.push({ at: Date.parse(nowIso), value: seriesRoot.current, status: null, entry: false });
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

// ── helpers ────────────────────────────────────────────────────────────

/** Validate the persisted `GoalCheckin.sections` JSON into typed sections. */
function parseSections(raw: unknown): GoalUpdateSection[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GoalUpdateSection[] = [];
  for (const s of raw) {
    if (
      s &&
      typeof s === "object" &&
      typeof (s as { title?: unknown }).title === "string" &&
      typeof (s as { body?: unknown }).body === "string"
    ) {
      out.push({ title: (s as GoalUpdateSection).title, body: (s as GoalUpdateSection).body });
    }
  }
  return out.length > 0 ? out : null;
}

function toFloat(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  if (typeof d === "number") return d;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/** Ensures `key` maps to a fresh array in `map`, returns it (for push chaining). */
function setAndGet<V>(map: Map<string, V[]>, key: string): V[] {
  const arr: V[] = [];
  map.set(key, arr);
  return arr;
}

function manualKrTrio(): RollupTrio {
  // Manuelle KRs haben keinen €-Rollup (kein valuePerUnit auf der
  // Bruecke). UI zeigt „Manueller Modus".
  return { planned: 0, realized: 0, runRate: 0 };
}
