import type { PrismaClient } from "@/generated/prisma";
import { sumTrios, type KpiInput, type RollupTrio } from "@/modules/core/goals/domain/goals-rollup";
import { parseOptions } from "@/modules/core/goals/domain/goal-custom-field";
import { filterGoalBranches } from "@/modules/core/goals/domain/goal-tree-filter";
import { goalTimeframe, timeframeMatchesPeriodKeys } from "@/modules/core/goals/domain/goal-period";
import {
  type ProgressMode,
  type AutoKpiLink,
} from "@/modules/core/goals/domain/goal-progress-mode";
import { type AutoKpiSeriesLink } from "@/modules/core/goals/domain/goal-progress-series";
import { parseMeasurements, latestMeasurement } from "@/modules/core/kpi/domain/kpi-measurement";
import {
  buildStrategyTree,
  buildProgressChart as deriveProgressChart,
  type ForestObjective,
  type ForestRelatedEpic,
  type ForestLookups,
  type ForestCustomFieldDef,
  type ChartObjective,
  type ChartRootCheckin,
} from "./goals-forest";

/**
 * Ziele-/Strategie-Loader.
 *
 *  - `loadStrategyTree(db, tenantId, { period? })` — die Theme→KR-
 *    Hierarchie mit €-Trios pro Ebene. Konsumenten: `/ziele`-Shell
 *    (Übersicht + Pflege, eine Surface).
 *
 * Ein Page-Model fasst Page-spezifische Daten zusammen — `permissions`
 * und der UI-`tab` leben deshalb in der Page, nicht im Loader.
 * CONTEXT.md §Page-model.
 */

export type ZieleSubTab = "strategie" | "money" | "pflege";

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
  /** Individueller Umsetzungszeitraum (ISO) — gewinnt über `period`, wenn gesetzt. */
  periodStart: string | null;
  periodEnd: string | null;
  /** Persistierter Goal-Status (src/domain/goal-status.ts) oder null. */
  status: string | null;
  dueDate: string | null;
  ownerId: string | null;
  /** Verantwortliches Team (Asana „Accountable team"); null = keins. */
  accountableTeam: ScopeRef | null;
  latestCheckin: GoalLatestCheckin | null;
  // ── Metrik (nur bei messbaren Blättern relevant) ──
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  /** Relatives Gewicht im Eltern-Rollup (Epic 3); null = Default 1. */
  rollupWeight: number | null;
  /** Umrechnung eigene Metrik-Einheit → Eltern-Metrik-Einheit (Einheiten-Kaskade). */
  parentUnitPerChildUnit: number | null;
  /** Asana „Remove from automatic progress": false = zählt nicht im Eltern-Rollup. */
  includeInParentRollup: boolean;
  /** Normalisierter Beitrag 0..1 (= Gewicht / Σ Geschwister-Gewichte). */
  contributionShare: number;
  baseline: number | null;
  target: number | null;
  /** Ist-Wert; bei `progressMode = "auto_kpi"` die abgeleitete Summe. */
  current: number | null;
  /** Fortschrittsquelle (effektiv aufgelöst): manual | rollup | auto_kpi. */
  progressMode: ProgressMode;
  /** Ob der Knoten einen 0..1-Fortschritt liefern kann (für Board/Filter). */
  isMeasurable: boolean;
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
  /** Einheiten-Kaskade: rekursiver Wert in der EIGENEN Metrik-Einheit dieses
   *  Knotens (Σ Kinder × Faktor + verknüpfte Erfolgs-KPIs). */
  unitValue: RollupTrio;
}

export interface ZielePermissions {
  /** Strategie + OKRs editieren (LPM-Surface). */
  canEditStrategy: boolean;
  /** Finance-Controller: KPI valuePerUnit + KR-KPI-Bindung pflegen. */
  canEditKpiValuation: boolean;
}

/**
 * Entitlement-Sicht des aktiven Tenants für die Ziele-UI (Freemium): welche
 * Quell-Module für Premium-Inhalte freigeschaltet sind. Im Personal-Free-Tenant
 * (nur `ziele`) sind alle drei false — die Shell/der Drawer rendern dann
 * 🔒-Upsell-Hinweise statt leerer Premium-Picker (Money-Tab, Related-Work-Suche,
 * Team-/VS-/ART-Picker, Controlling-Deeplink). Von den Pages aus
 * `principal.enabledModules` abgeleitet.
 */
export interface ZieleModuleAccess {
  /** Epics/KPIs/Value Streams (€-Rollup, Epic-Verknüpfung, VS-Verantwortung). */
  portfolio: boolean;
  /** ARTs/Teams/Features/PIs (Team-Picker, ART-Verantwortung, Related Work). */
  program: boolean;
  /** KPI-Coverage-Pflegefläche (Controlling-Deeplink). */
  controlling: boolean;
}

export interface StrategyTree {
  /** Top-Level-Goal-Knoten (die „Themes"); je Knoten `children` beliebig tief. */
  themes: GoalNode[];
  /** Tenant-Gesamt-Rollup (Summe ueber alle Top-Level-Knoten). */
  tenantTrio: RollupTrio;
  /** Aktive Filter (Mehrfachauswahl, CSV in der URL) — Echo für Deep-Links/Badges. */
  periods: string[];
  valueStreamIds: string[];
  artIds: string[];
  /** Status-Filter: `GoalStatus`-Werte + Sentinel `"none"` (= ohne Status). */
  statuses: string[];
  /**
   * Tenant-weite Custom-Field-Definitionen (einmalig, NICHT je Knoten). Die
   * Knoten tragen nur ihre gesetzten Werte (`GoalNode.customFields`, sparse); der
   * Drawer merged Defs + Werte fürs Editier-Formular.
   */
  customFieldDefs: ForestCustomFieldDef[];
}

/**
 * Composite-Modell, das die Ziele/Strategy-Shell konsumiert. Das Modell
 * wird in der Page zusammengesetzt — der Loader liefert nur den
 * Strategy-Tree; tab/permissions kommen von oben dazu.
 */
export interface ZieleModel extends StrategyTree, ZieleSubTabState {
  permissions: ZielePermissions;
  /** Freigeschaltete Premium-Quell-Module (Freemium-Entitlement des Tenants). */
  modules: ZieleModuleAccess;
}

interface ZieleSubTabState {
  tab: ZieleSubTab;
}

export async function loadStrategyTree(
  db: PrismaClient,
  tenantId: string,
  input: {
    periods?: string[] | undefined;
    valueStreamIds?: string[] | undefined;
    artIds?: string[] | undefined;
    statuses?: string[] | undefined;
  } = {},
): Promise<StrategyTree> {
  const periods = input.periods ?? [];
  const valueStreamIds = input.valueStreamIds ?? [];
  const artIds = input.artIds ?? [];
  const statuses = input.statuses ?? [];

  // Alle Goal-Knoten des Tenants flach laden (Objective = einziger Knotentyp).
  // Der Baum wird in JS über parentObjectiveId gebaut; kein rekursiver Include.
  const objectiveRows = await db.objective.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      accountableTeam: { select: { id: true, name: true } },
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
  const relatedByNode = new Map<string, ForestRelatedEpic[]>();
  const autoKpiLinksByNode = new Map<string, AutoKpiLink[]>();
  if (nodeIds.length > 0) {
    const epicLinks = await db.goalEpicLink.findMany({
      where: { tenantId, epic: { deletedAt: null }, objectiveId: { in: nodeIds } },
      include: {
        kpi: {
          select: {
            id: true,
            baseline: true,
            target: true,
            measurements: true,
            valuePerUnit: true,
          },
        },
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
      // Einheiten-Kaskade: gewählte Erfolgs-KPI (falls gesetzt) + Umrechnungsfaktor.
      const successKpi: KpiInput | null = link.kpi
        ? {
            id: link.kpi.id,
            baseline: toFloat(link.kpi.baseline),
            target: toFloat(link.kpi.target),
            current: latestMeasurement(link.kpi.measurements),
            valuePerUnit: toFloat(link.kpi.valuePerUnit),
          }
        : null;
      // €-Trio wird im Goal-Forest-Read-Model gerechnet (resolveNode); der Loader
      // reicht nur die Routing-Infos + normalisierten KPIs durch.
      (relatedByNode.get(link.objectiveId) ?? setAndGet(relatedByNode, link.objectiveId)).push({
        epicId: link.epic.id,
        title: link.epic.title,
        stageGate: link.epic.stageGate,
        href: `/portfolio/epics/${link.epic.id}`,
        kpis,
        successKpi,
        conversionFactor: toFloat(link.conversionFactor),
        impactKind: link.impactKind,
        recurringInterval: link.recurringInterval,
      });
      // auto_kpi-Ist: Faktor bevorzugt (gewählte KPI-Δ × Faktor), sonst
      // einheiten-gleiches KPI-Δ. Je Link die volle baseline/target/current-Info,
      // damit `autoKpiCurrent` das Delta (Verbesserung) rechnen kann.
      const autoLinks =
        autoKpiLinksByNode.get(link.objectiveId) ?? setAndGet(autoKpiLinksByNode, link.objectiveId);
      autoLinks.push(
        link.kpi && link.conversionFactor != null
          ? {
              kind: "factor",
              kpi: {
                baseline: toFloat(link.kpi.baseline),
                target: toFloat(link.kpi.target),
                current: latestMeasurement(link.kpi.measurements),
              },
              factor: Number(link.conversionFactor),
            }
          : {
              kind: "sameUnit",
              kpis: link.epic.kpis.map((k) => ({
                unit: k.unit,
                point: {
                  baseline: toFloat(k.baseline),
                  target: toFloat(k.target),
                  current: latestMeasurement(k.measurements),
                },
              })),
            },
      );
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

  // Normalisierte Zeilen fürs Goal-Forest-Read-Model (reine, DB-freie Ableitung).
  const forestRows: ForestObjective[] = objectiveRows.map((o) => ({
    id: o.id,
    parentObjectiveId: o.parentObjectiveId,
    nodeKind: o.nodeKind,
    title: o.title,
    narrative: o.narrative,
    period: o.period,
    periodStart: o.periodStart ? o.periodStart.toISOString() : null,
    periodEnd: o.periodEnd ? o.periodEnd.toISOString() : null,
    status: o.status,
    dueDate: o.dueDate ? o.dueDate.toISOString() : null,
    ownerId: o.ownerId,
    accountableTeam: o.accountableTeam
      ? { id: o.accountableTeam.id, name: o.accountableTeam.name }
      : null,
    metricUnit: o.metricUnit,
    metricType: o.metricType,
    precision: o.precision,
    currencyCode: o.currencyCode,
    rollupWeight: toFloat(o.rollupWeight),
    parentUnitPerChildUnit: toFloat(o.parentUnitPerChildUnit),
    includeInParentRollup: o.includeInParentRollup,
    baseline: toFloat(o.baseline),
    target: toFloat(o.target),
    current: toFloat(o.current),
    progressMode: o.progressMode,
  }));

  const lookups: ForestLookups = {
    latestCheckin: latestByNode,
    relatedEpics: relatedByNode,
    autoKpiLinks: autoKpiLinksByNode,
    relatedWork: relatedWorkByNode,
    valueStreams: valueStreamsByNode,
    arts: artsByNode,
    customFieldDefs: parsedDefs,
    customFieldValues: valueByNode,
  };

  const { themes } = buildStrategyTree({ rows: forestRows, lookups });

  // Filter (Mehrfachauswahl): strikt (filterGoalBranches — nur Treffer + Eltern-Pfad), UND zwischen den
  // Gruppen (Komposition), ODER innerhalb (`includes`/`some`). tenantTrio wird
  // danach über die sichtbaren Roots neu summiert.
  let topLevel = themes;
  if (periods.length) {
    // Range-Ziel → Überlappung mit einem gewählten Bucket, Bucket-Ziel → exakter Key;
    // die Diskriminierung kennt allein `timeframeMatchesPeriodKeys` (goal-period).
    topLevel = filterGoalBranches(topLevel, (n) =>
      timeframeMatchesPeriodKeys(goalTimeframe(n.period, n.periodStart, n.periodEnd), periods),
    );
  }
  if (valueStreamIds.length) {
    topLevel = filterGoalBranches(topLevel, (n) =>
      n.valueStreams.some((v) => valueStreamIds.includes(v.id)),
    );
  }
  if (artIds.length) {
    topLevel = filterGoalBranches(topLevel, (n) => n.arts.some((a) => artIds.includes(a.id)));
  }
  if (statuses.length) {
    const wantNull = statuses.includes("none");
    const realStatuses = statuses.filter((s) => s !== "none");
    topLevel = filterGoalBranches(
      topLevel,
      (n) =>
        (n.status == null && wantNull) || (n.status != null && realStatuses.includes(n.status)),
    );
  }

  return {
    themes: topLevel,
    tenantTrio: sumTrios(topLevel.map((t) => t.trio)),
    periods,
    valueStreamIds,
    artIds,
    statuses,
    customFieldDefs: parsedDefs,
  };
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

/**
 * „Expected pace" — die Ideallinie (Asana): von (Zeitraum-Start, Baseline bzw. 0 %)
 * zu (Deadline, Target bzw. 100 %). Rein visuelle Orientierung (vor/hinter Plan).
 */
export interface ProgressPace {
  fromMs: number;
  toMs: number;
  from: number;
  to: number;
}

export interface ProgressChart {
  /** "value" = Roh-Wert (messbar); "percent" = 0..100 (Rollup). */
  mode: "value" | "percent";
  series: ProgressChartPoint[];
  yDomain: [number, number];
  /** Ideallinie über den Ziel-Zeitraum; null wenn kein Zeitraum gesetzt. */
  pace: ProgressPace | null;
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

  const progressChart = await loadProgressChart(db, tenantId, id);

  return { checkins, comments, activity, progressChart };
}

/**
 * Baut die Graf-Serie: die Linie folgt der Fortschrittsquelle des Knotens
 * (KPI-Verlauf / Rollup der Unterziele / manuelle Snapshots), die farbigen
 * Punkte sind die eigenen Status-Check-ins. Lädt dafür den Subtree (Nachfahren
 * über den `path`-Präfix) samt Check-ins und verknüpften Epic-KPIs.
 */
async function loadProgressChart(
  db: PrismaClient,
  tenantId: string,
  id: string,
): Promise<ProgressChart> {
  const empty: ProgressChart = { mode: "percent", series: [], yDomain: [0, 100], pace: null };
  const root = await db.objective.findFirst({
    where: { id, tenantId },
    select: { id: true, path: true, period: true, periodStart: true, periodEnd: true },
  });
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
      includeInParentRollup: true,
      metricUnit: true,
      metricType: true,
      currencyCode: true,
      status: true,
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
        conversionFactor: true,
        kpi: { select: { baseline: true, target: true, measurements: true } },
        epic: {
          select: {
            kpis: { select: { unit: true, baseline: true, target: true, measurements: true } },
          },
        },
      },
    }),
  ]);

  // Normalisieren fürs reine Goal-Forest-Chart-Read-Model.
  const progressByNode = new Map<string, { at: string; progress: number }[]>();
  const rootCheckins: ChartRootCheckin[] = [];
  for (const c of checkinAll) {
    if (!c.objectiveId) continue;
    if (c.progress != null) {
      (progressByNode.get(c.objectiveId) ?? setAndGet(progressByNode, c.objectiveId)).push({
        at: c.createdAt.toISOString(),
        progress: Number(c.progress),
      });
    }
    if (c.objectiveId === id) {
      rootCheckins.push({
        atMs: c.createdAt.getTime(),
        status: c.status,
        value: toFloat(c.value),
        progress: toFloat(c.progress),
      });
    }
  }
  // auto_kpi-Verlauf: je Link Faktor bevorzugt (gewählte KPI-Messreihe × Faktor),
  // sonst die Messreihen der einheiten-gleichen Epic-KPIs — analog `autoKpiCurrent`.
  const autoKpiSeriesByNode = new Map<string, AutoKpiSeriesLink[]>();
  for (const l of epicLinks) {
    if (!l.objectiveId) continue;
    const arr =
      autoKpiSeriesByNode.get(l.objectiveId) ?? setAndGet(autoKpiSeriesByNode, l.objectiveId);
    arr.push(
      l.kpi && l.conversionFactor != null
        ? {
            kind: "factor",
            kpiBaseline: toFloat(l.kpi.baseline),
            kpiTarget: toFloat(l.kpi.target),
            measurements: parseMeasurements(l.kpi.measurements),
            factor: Number(l.conversionFactor),
          }
        : {
            kind: "sameUnit",
            kpis: l.epic.kpis.map((k) => ({
              unit: k.unit,
              baseline: toFloat(k.baseline),
              target: toFloat(k.target),
              measurements: parseMeasurements(k.measurements),
            })),
          },
    );
  }

  const rows: ChartObjective[] = subtreeRows.map((r) => ({
    id: r.id,
    parentObjectiveId: r.parentObjectiveId,
    progressMode: r.progressMode,
    baseline: toFloat(r.baseline),
    target: toFloat(r.target),
    current: toFloat(r.current),
    rollupWeight: toFloat(r.rollupWeight),
    includeInParentRollup: r.includeInParentRollup,
    metricUnit: r.metricUnit,
    metricType: r.metricType,
    currencyCode: r.currencyCode,
    status: r.status,
  }));

  return deriveProgressChart({
    rootId: id,
    rows,
    progressByNode,
    autoKpiSeriesByNode,
    rootCheckins,
    now: new Date().toISOString(),
    rootPeriod: root.period,
    rootPeriodStart: root.periodStart ? root.periodStart.toISOString() : null,
    rootPeriodEnd: root.periodEnd ? root.periodEnd.toISOString() : null,
  });
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
