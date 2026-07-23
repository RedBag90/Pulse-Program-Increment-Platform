import type { PrismaClient } from "@/generated/prisma";
import {
  horizonShare,
  keyResultTrio,
  keyResultProgress,
  kpiContributionDetail,
  epicLinkTrio,
  rollupObjectiveProgress,
  sumTrios,
  type KpiInput,
  type KrContributionInput,
  type RollupTrio,
} from "@/domain/goals-rollup";

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

export interface ZieleTreeKeyResult {
  id: string;
  title: string;
  metricUnit: string | null;
  metricType: string;
  precision: number;
  currencyCode: string | null;
  /** Relatives Gewicht im Objective-Rollup (Epic 3); null = Default 1. */
  rollupWeight: number | null;
  /** Normalisierter Beitrag 0..1 (= Gewicht / Σ Geschwister-Gewichte). */
  contributionShare: number;
  baseline: number | null;
  target: number | null;
  current: number | null;
  /** Zeitraum, kanonisch YYYY-Qn | YYYY-Hn | YYYY (goal-period) oder null. */
  period: string | null;
  formula: string;
  ownerId: string | null;
  /** Persistierter Goal-Status (src/domain/goal-status.ts) oder null. */
  status: string | null;
  dueDate: string | null;
  latestCheckin: GoalLatestCheckin | null;
  trio: RollupTrio;
  /** Wie viele KPIs an diesen KR gebunden sind. */
  kpiCount: number;
  /** Liste aller gebundenen KPIs inkl. Weight + €-Beitrag (KPI-Tab). */
  contributions: ZieleKrContribution[];
  /** Direkt verknüpfte Epics ("Related work"); ihr € ist im `trio` enthalten. */
  relatedEpics: RelatedEpic[];
}

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

/**
 * **Theme** in der flachen 2-Ebenen-Hierarchie (Refactor §Hierarchie-
 * Vereinfachung): die OKR-formulierte Top-Ebene unter dem Tenant.
 *
 * Technisch ist das ein `Objective`-Row aus dem Schema; UI nennt es
 * „Theme". Der ehemalige `StrategicTheme`-Layer existiert noch im
 * Schema (als versteckter Datenmodell-Anker), wird aber nicht mehr
 * gerendert.
 */
export interface ZieleTreeTheme {
  id: string;
  title: string;
  narrative: string | null;
  period: string | null;
  confidence: number | null;
  /** Persistierter Goal-Status (src/domain/goal-status.ts) oder null. */
  status: string | null;
  dueDate: string | null;
  latestCheckin: GoalLatestCheckin | null;
  ownerId: string | null;
  keyResults: ZieleTreeKeyResult[];
  /** Completion 0..1 = normalisierter Ø der KR-Fortschritte (ADR-0008);
   *  `null`, wenn das Theme keine Key Results hat. Getrennt vom €-`trio`. */
  progress: number | null;
  trio: RollupTrio;
  /** Direkt am Theme verknüpfte Epics ("Related work"); ihr € ist im `trio`. */
  relatedEpics: RelatedEpic[];
}

export interface ZielePermissions {
  /** Strategie + OKRs editieren (LPM-Surface). */
  canEditStrategy: boolean;
  /** Finance-Controller: KPI valuePerUnit + KR-KPI-Bindung pflegen. */
  canEditKpiValuation: boolean;
}

export interface StrategyTree {
  themes: ZieleTreeTheme[];
  /** Tenant-Gesamt-Rollup (Summe ueber alle Themes). */
  tenantTrio: RollupTrio;
  /** Period-Filter (z. B. „2026-Q2") oder `null` fuer „Alle". */
  period: string | null;
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
  input: { period?: string | undefined } = {},
): Promise<StrategyTree> {
  const period = input.period ?? null;

  // Objectives = die flachen „Themes" unter dem Tenant.
  const objectiveWhere = period ? { tenantId, period } : { tenantId };
  const objectiveRows = await db.objective.findMany({
    where: objectiveWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      keyResults: {
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
      },
    },
  });

  // Horizont-Anker: aus Tenant.dashboardHorizonEnd, sonst 1 Jahr ab heute
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { dashboardHorizonEnd: true },
  });
  const now = new Date();
  const horizonStart = startOfYear(now);
  const horizonEnd = tenant?.dashboardHorizonEnd ?? addMonths(now, 12);
  const share = horizonShare(now, horizonStart, horizonEnd);

  // Letzter Check-in je Ziel (Objective + KR) für Pill + „vor X Tagen".
  // Eine Query, neueste zuerst, in JS auf den ersten Treffer pro Entity
  // reduziert (Check-ins sind pro Ziel wenige).
  const objectiveIds = objectiveRows.map((o) => o.id);
  const keyResultIds = objectiveRows.flatMap((o) => o.keyResults.map((k) => k.id));
  const latestByObjective = new Map<string, GoalLatestCheckin>();
  const latestByKeyResult = new Map<string, GoalLatestCheckin>();
  if (objectiveIds.length > 0 || keyResultIds.length > 0) {
    const checkins = await db.goalCheckin.findMany({
      where: {
        tenantId,
        // Reine Progress-Updates (status = null) stempeln kein "vor X Tagen"
        // in der Status-Spalte — nur echte Status-Check-ins.
        status: { not: null },
        OR: [{ objectiveId: { in: objectiveIds } }, { keyResultId: { in: keyResultIds } }],
      },
      orderBy: { createdAt: "desc" },
      select: { objectiveId: true, keyResultId: true, status: true, createdAt: true },
    });
    for (const c of checkins) {
      if (c.status == null) continue;
      if (c.objectiveId && !latestByObjective.has(c.objectiveId)) {
        latestByObjective.set(c.objectiveId, { status: c.status, at: c.createdAt.toISOString() });
      }
      if (c.keyResultId && !latestByKeyResult.has(c.keyResultId)) {
        latestByKeyResult.set(c.keyResultId, { status: c.status, at: c.createdAt.toISOString() });
      }
    }
  }

  // "Related work": direkt verknüpfte Epics je Ziel-Knoten — EINE Query über
  // alle Knoten-IDs (kein N+1), soft-gelöschte Epics ausgeblendet. Der
  // €-Beitrag jedes Epics kommt aus seinen KPIs (epicLinkTrio).
  const relatedByObjective = new Map<string, RelatedEpic[]>();
  const relatedByKeyResult = new Map<string, RelatedEpic[]>();
  if (objectiveIds.length > 0 || keyResultIds.length > 0) {
    const epicLinks = await db.goalEpicLink.findMany({
      where: {
        tenantId,
        epic: { deletedAt: null },
        OR: [{ objectiveId: { in: objectiveIds } }, { keyResultId: { in: keyResultIds } }],
      },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
            stageGate: true,
            kpis: {
              select: {
                id: true,
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
        trio: epicLinkTrio([{ epicId: link.epic.id, kpis }], share),
        href: `/portfolio/epics/${link.epic.id}`,
      };
      if (link.objectiveId) {
        (
          relatedByObjective.get(link.objectiveId) ??
          setAndGet(relatedByObjective, link.objectiveId)
        ).push(related);
      } else if (link.keyResultId) {
        (
          relatedByKeyResult.get(link.keyResultId) ??
          setAndGet(relatedByKeyResult, link.keyResultId)
        ).push(related);
      }
    }
  }

  const themes: ZieleTreeTheme[] = objectiveRows.map((o) => {
    const krs: ZieleTreeKeyResult[] = o.keyResults.map((k) => {
      const kpisById = new Map<string, KpiInput>();
      for (const c of k.kpiContributions) {
        kpisById.set(c.kpi.id, {
          id: c.kpi.id,
          baseline: toFloat(c.kpi.baseline),
          target: toFloat(c.kpi.target),
          current: latestMeasurement(c.kpi.measurements),
          valuePerUnit: toFloat(c.kpi.valuePerUnit),
        });
      }
      const contributions: KrContributionInput[] = k.kpiContributions.map((c) => ({
        kpiId: c.kpiId,
        weight: Number(c.weight),
        valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
      }));
      const baseTrio =
        k.formula === "auto_from_kpi"
          ? keyResultTrio(contributions, kpisById, share)
          : manualKrTrio();
      // Direkt am KR verknüpfte Epics tragen ihren KPI-Wert bei (Count-once
      // stellt sicher, dass diese KPIs nicht zusätzlich einzeln gezählt werden).
      const krRelatedEpics = relatedByKeyResult.get(k.id) ?? [];
      const trio = krRelatedEpics.length
        ? sumTrios([baseTrio, ...krRelatedEpics.map((r) => r.trio)])
        : baseTrio;

      const contributionDetails: ZieleKrContribution[] = k.kpiContributions.map((c) => {
        const detail = kpiContributionDetail(
          kpisById.get(c.kpiId),
          {
            kpiId: c.kpiId,
            weight: Number(c.weight),
            valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
          },
          share,
        );
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

      return {
        id: k.id,
        title: k.title,
        metricUnit: k.metricUnit,
        metricType: k.metricType,
        precision: k.precision,
        currencyCode: k.currencyCode,
        rollupWeight: toFloat(k.rollupWeight),
        contributionShare: 0, // unten aus Σ Geschwister-Gewichte gefüllt
        baseline: toFloat(k.baseline),
        target: toFloat(k.target),
        current: toFloat(k.current),
        period: k.period,
        formula: k.formula,
        ownerId: k.ownerId,
        status: k.status,
        dueDate: k.dueDate ? k.dueDate.toISOString() : null,
        latestCheckin: latestByKeyResult.get(k.id) ?? null,
        trio,
        kpiCount: k.kpiContributions.length,
        contributions: contributionDetails,
        relatedEpics: krRelatedEpics,
      };
    });

    // Gewichte (null ⇒ Default 1) normalisieren → contributionShare je KR.
    const weights = krs.map((k) => k.rollupWeight ?? 1);
    const weightSum = weights.reduce((s, w) => s + w, 0);
    krs.forEach((k, i) => {
      k.contributionShare = weightSum > 0 ? (weights[i] ?? 1) / weightSum : 0;
    });

    // Direkt am Theme (Objective) verknüpfte Epics — zusätzlich zu den KRs.
    const themeRelatedEpics = relatedByObjective.get(o.id) ?? [];

    return {
      id: o.id,
      title: o.title,
      narrative: o.narrative,
      period: o.period,
      confidence: o.confidence,
      status: o.status,
      dueDate: o.dueDate ? o.dueDate.toISOString() : null,
      latestCheckin: latestByObjective.get(o.id) ?? null,
      ownerId: o.ownerId,
      keyResults: krs,
      // Completion = gewichteter normalisierter Ø der KR-Fortschritte
      // (ADR-0008 / Epic 3); gleiche Gewichte ⇒ ungewichteter Ø.
      progress: rollupObjectiveProgress(
        krs.map((k) => keyResultProgress(k)),
        weights,
      ),
      trio: sumTrios([...krs.map((k) => k.trio), ...themeRelatedEpics.map((r) => r.trio)]),
      relatedEpics: themeRelatedEpics,
    };
  });

  return {
    themes,
    tenantTrio: sumTrios(themes.map((t) => t.trio)),
    period,
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

  type KrLookup = { title: string; themeId: string; themeTitle: string };
  const krLookup = new Map<string, KrLookup>();
  for (const t of tree.themes) {
    for (const kr of t.keyResults) {
      krLookup.set(kr.id, { title: kr.title, themeId: t.id, themeTitle: t.title });
    }
  }

  type BindingDetail = {
    keyResultId: string;
    weight: number;
    valuePerUnitOverride: number | null;
    contributionRealized: number;
  };
  const bindingByKpiId = new Map<string, BindingDetail>();
  for (const t of tree.themes) {
    for (const kr of t.keyResults) {
      for (const c of kr.contributions) {
        if (!bindingByKpiId.has(c.kpiId)) {
          bindingByKpiId.set(c.kpiId, {
            keyResultId: kr.id,
            weight: c.weight,
            valuePerUnitOverride: c.valuePerUnitOverride,
            contributionRealized: c.contributionRealized,
          });
        }
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

  const krLibrary: ZieleKrLibraryEntry[] = [];
  for (const t of tree.themes) {
    for (const kr of t.keyResults) {
      krLibrary.push({ id: kr.id, title: kr.title, themeId: t.id, themeTitle: t.title });
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

export interface GoalDetail {
  /** Chronological (ascending) check-ins — backs the progress chart. */
  checkins: GoalCheckinEntry[];
  comments: GoalCommentEntry[];
  /** Merged feed (audit + check-ins + comments), newest first. */
  activity: GoalActivityEntry[];
}

/**
 * Full detail bundle for a single goal (Objective or Key Result) — loaded
 * on demand when the drawer opens. Keeps the list loader lean.
 */
export async function loadGoalDetail(
  db: PrismaClient,
  tenantId: string,
  target: GoalTarget,
  id: string,
): Promise<GoalDetail> {
  const where =
    target === "objective" ? { tenantId, objectiveId: id } : { tenantId, keyResultId: id };
  const auditResourceType = target === "objective" ? "objective" : "key_result";

  const [checkinRows, commentRows, auditRows] = await Promise.all([
    db.goalCheckin.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.goalComment.findMany({ where, orderBy: { createdAt: "desc" } }),
    db.auditEvent.findMany({
      where: { tenantId, resourceType: auditResourceType, resourceId: id },
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

  return { checkins, comments, activity };
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

function latestMeasurement(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const pts = raw as Array<{ date?: string; value?: number }>;
  if (pts.length === 0) return null;
  const sorted = pts
    .filter((p) => typeof p.value === "number" && typeof p.date === "string")
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const last = sorted[sorted.length - 1];
  return last?.value ?? null;
}

function manualKrTrio(): RollupTrio {
  // Manuelle KRs haben keinen €-Rollup (kein valuePerUnit auf der
  // Bruecke). UI zeigt „Manueller Modus".
  return { planned: 0, realized: 0, runRate: 0 };
}

function startOfYear(d: Date): Date {
  const y = d.getUTCFullYear();
  return new Date(Date.UTC(y, 0, 1));
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}
