import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId } from "@/domain/types";
import { listEpics } from "@/server/services/epic";
import { getBudgetingBoard, getValueStreamBudgets } from "@/server/services/budgeting";
import { listImpedimentsForArts } from "@/server/services/impediment";
import {
  computeStructureGap,
  computePracticeAdoption,
  deriveNextSteps,
  type StructureGap,
  type PracticeAdoption,
  type NextStep,
} from "@/server/services/transformation";
import { halfYearKey } from "@/domain/calendar";
import { epicBucket } from "@/domain/stage-gate";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";
import { isClosed } from "@/domain/goal-status";
import { loadStrategyTree } from "@/server/views/ziele-view";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Stage gate keys, in canonical Funnel→Done order. */
export const STAGE_GATES = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type StageGate = (typeof STAGE_GATES)[number];

export const STAGE_GATE_LABEL: Record<StageGate, string> = {
  L0: "Funnel",
  L1: "Hypothese erstellen",
  L2: "Analyzing",
  L3: "Portfolio Backlog",
  L4: "Implementing",
  L5: "Done",
};

// ---------------------------------------------------------------------------
// Output shape — what the three Mission/Hero/Executive variants consume.
// ---------------------------------------------------------------------------

export interface OverviewEpicCard {
  id: string;
  title: string;
  status: string;
  stageGate: string;
  /** Genutzt fuer Kanban-Bucket-Splitt L0+Owner → „Hypothese erstellen". */
  ownerId: string | null;
  /** Stamp aus dem BC-Approval-Pfad. Treibt den L2+BC-approved → L3-Bucket. */
  businessCaseApprovedAt: Date | null;
  valueStream: { id: string; name: string } | null;
  updatedAt: Date;
  daysSinceUpdate: number;
  needsSteeringAttention: boolean;
}

export interface OverviewGoal {
  id: string;
  title: string;
  status: string | null;
  progress: number;
  epicLinkCount: number;
}

export interface OverviewBudget {
  valueStreamId: string;
  name: string;
  total: number;
  currentPeriod: number;
  byPeriod: Record<string, number>;
}

export interface OverviewFundingPeriod {
  key: string;
  label: string;
  pool: number;
  allocated: number;
  remaining: number;
  isCurrent: boolean;
  isPast: boolean;
}

export interface OverviewFunding {
  currentPeriodKey: string;
  periods: OverviewFundingPeriod[];
  currentPeriod: OverviewFundingPeriod | null;
  upcomingPeriods: OverviewFundingPeriod[];
}

export interface OverviewActivePi {
  id: string;
  name: string;
  endDate: Date;
  daysRemaining: number;
}

export interface OverviewRecentEvent {
  id: string;
  title: string;
  stageGate: string;
  status: string;
  updatedAt: Date;
  valueStreamName: string | null;
}

export interface PortfolioOverview {
  epics: OverviewEpicCard[];
  epicsByGate: Record<StageGate, OverviewEpicCard[]>;
  epicsCount: number;

  oldestPerGate: Record<StageGate, OverviewEpicCard | null>;
  doneInLast90Days: number;
  funnelConversion: number;

  staleEpics: OverviewEpicCard[];
  blockedEpics: OverviewEpicCard[];
  impedimentsOpen: number;

  goals: OverviewGoal[];
  goalsOnTrack: number;
  goalAverageProgress: number;
  topGoal: OverviewGoal | null;

  budgets: OverviewBudget[];
  poolTotal: number;
  poolAllocated: number;
  poolFree: number;
  valueStreamCount: number;
  funding: OverviewFunding;

  activePis: OverviewActivePi[];
  nearestPiEnd: OverviewActivePi | null;

  recentActivity: OverviewRecentEvent[];

  nextSteps: NextStep[];
}

// ---------------------------------------------------------------------------
// Input shape — what the service loader hands the builder.
// ---------------------------------------------------------------------------

/**
 * Theme-Eingabe fuer die Portfolio-Overview. Entspricht der V2-Ziele-Welt:
 * ein `Objective` (in der UI "Theme") mit seinen Key-Result-Trios und der
 * Zahl direkt verlinkter Epics. Ersetzt die fruehere TransformationGoal-
 * Form, die seit der Hierarchie-Vereinfachung leer bleibt.
 */
export interface PortfolioOverviewTheme {
  id: string;
  title: string;
  status: string | null;
  trio: RollupTrio;
  epicLinkCount: number;
}

export interface PortfolioOverviewInputs {
  epics: Awaited<ReturnType<typeof listEpics>>;
  themes: PortfolioOverviewTheme[];
  board: Awaited<ReturnType<typeof getBudgetingBoard>>;
  vsBudgets: Awaited<ReturnType<typeof getValueStreamBudgets>>;
  activePis: Array<{ id: string; name: string; endDate: Date }>;
  impedimentsOpen: number;
  structureGap: StructureGap;
  practiceAdoption: PracticeAdoption;
  /** Pinned "today" — server passes `new Date()`, tests pass a fixed instant. */
  now: Date;
}

// ---------------------------------------------------------------------------
// Builder — pure presentation-glue. No I/O.
// ---------------------------------------------------------------------------

/**
 * Portfolio Overview page-model — turns the loaded aggregates into the
 * render-ready DTO every overview variant (Mission/Hero/Executive) consumes.
 * Pure: takes a typed `PortfolioOverviewInputs` bag with `now` injected, so
 * tests can pin the "current cycle" and "stale window" deterministically.
 *
 * The shape is wide (15 top-level fields) by design — the three variant
 * components stay pure pass-through.
 */
export function buildPortfolioOverviewModel(inputs: PortfolioOverviewInputs): PortfolioOverview {
  const {
    epics,
    themes,
    board,
    vsBudgets,
    activePis: activePisRaw,
    impedimentsOpen,
    structureGap,
    practiceAdoption,
    now,
  } = inputs;
  const nowMs = now.getTime();

  const cards: OverviewEpicCard[] = epics.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    stageGate: e.stageGate,
    ownerId: e.ownerId,
    businessCaseApprovedAt: e.businessCaseApprovedAt,
    valueStream: e.valueStream,
    updatedAt: e.updatedAt,
    daysSinceUpdate: Math.floor((nowMs - new Date(e.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
    needsSteeringAttention: e.needsSteeringAttention,
  }));

  // Group epics by Kanban-Bucket. Wichtig: Bucket != Stage-Gate.
  // Bucket-Regel lebt in `domain/stage-gate.ts` (`epicBucket`). Konsumenten
  // (compact-kanban, period-banner) sehen die Karte in der jeweiligen Spalte;
  // STAGE_GATE_LABEL und das `stageGate`-Feld am Card sind unangetastet.
  const epicsByGate = Object.fromEntries(
    STAGE_GATES.map((g) => [g, [] as OverviewEpicCard[]]),
  ) as Record<StageGate, OverviewEpicCard[]>;
  for (const c of cards) {
    const gate = (STAGE_GATES as readonly string[]).includes(c.stageGate)
      ? (c.stageGate as StageGate)
      : null;
    if (!gate) continue;
    const bucket = epicBucket({
      stageGate: gate,
      ownerId: c.ownerId,
      businessCaseApprovedAt: c.businessCaseApprovedAt,
    });
    epicsByGate[bucket].push(c);
  }
  for (const gate of STAGE_GATES) {
    // Sortierung im Kanban: zuerst die fürs nächste Steering markierten
    // Epics (gelbe Karten), danach unmarkierte. Innerhalb jeder Gruppe
    // weiter oldest-first, damit der „liegt am längsten"-Hinweis bleibt.
    epicsByGate[gate].sort((a, b) => {
      if (a.needsSteeringAttention !== b.needsSteeringAttention) {
        return a.needsSteeringAttention ? -1 : 1;
      }
      return b.daysSinceUpdate - a.daysSinceUpdate;
    });
  }

  // `oldestPerGate` bewusst von der Display-Sortierung entkoppelt:
  // der „Flow & Pipeline"-Block braucht das tatsächlich älteste Epic
  // pro Gate, egal ob es markiert ist oder nicht.
  const oldestPerGate = Object.fromEntries(
    STAGE_GATES.map((g) => {
      const arr = epicsByGate[g];
      if (arr.length === 0) return [g, null];
      const oldest = arr.reduce((max, c) => (c.daysSinceUpdate > max.daysSinceUpdate ? c : max));
      return [g, oldest];
    }),
  ) as Record<StageGate, OverviewEpicCard | null>;

  // L5 (Done) epics whose last update is within 90 days serve as a coarse
  // throughput proxy until we have explicit stage-entry timestamps.
  const doneInLast90Days = cards.filter(
    (c) => c.stageGate === "L5" && nowMs - new Date(c.updatedAt).getTime() <= NINETY_DAYS_MS,
  ).length;
  const funnelCount = epicsByGate.L0.length;
  const funnelConversion =
    doneInLast90Days + funnelCount === 0 ? 0 : doneInLast90Days / (doneInLast90Days + funnelCount);

  const staleEpics = cards.filter(
    (c) =>
      nowMs - new Date(c.updatedAt).getTime() > THIRTY_DAYS_MS &&
      c.status !== "completed" &&
      c.status !== "cancelled",
  );
  const blockedEpics = cards.filter((c) => c.status === "blocked");

  // Strategy — Themes (Objectives in V2) statt legacy TransformationGoals.
  // Progress je Theme: Realized / Planned aus dem KR-Rollup; manuelle KRs
  // (kein €-Trio) bleiben aussen vor und ziehen den Schnitt nicht.
  const themeProgress = (t: PortfolioOverviewTheme): number => {
    if (t.trio.planned <= 0) return 0;
    return Math.max(0, Math.min(1, t.trio.realized / t.trio.planned));
  };
  const goals: OverviewGoal[] = themes.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    progress: themeProgress(t),
    epicLinkCount: t.epicLinkCount,
  }));
  // In-flight = offen oder noch ohne Check-in (null); geschlossene Ziele
  // (achieved/partial/missed/dropped) zaehlen nicht zu den aktiven.
  const isInFlight = (s: string | null) => !isClosed(s);
  const activeGoals = goals.filter((g) => isInFlight(g.status));
  const goalAverageProgress =
    activeGoals.length === 0
      ? 0
      : activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length;
  // "On-track" = nicht im Drift-Bereich (Run-Rate >= 70% des Planned).
  const activeThemes = themes.filter((t) => isInFlight(t.status));
  const goalsOnTrack = activeThemes.filter((t) => !isAtRisk(t.trio)).length;
  const topGoal =
    activeGoals.length === 0 ? null : [...activeGoals].sort((a, b) => b.progress - a.progress)[0]!;

  // Funding — derive pool vs allocated per half-year. Pool lives on the
  // tenant (`budgetPoolByPeriod`); allocations come from per-Epic budget rows
  // rolled up by Value Stream.
  const currentPeriodKey = halfYearKey(now);
  const fundingPeriods: OverviewFundingPeriod[] = board.periods.map((p) => {
    const pool = board.pool[p.key] ?? 0;
    const allocated = vsBudgets.valueStreams.reduce((s, vs) => s + (vs.byPeriod[p.key] ?? 0), 0);
    return {
      key: p.key,
      label: p.label,
      pool,
      allocated,
      remaining: pool - allocated,
      isCurrent: p.key === currentPeriodKey,
      isPast: p.key < currentPeriodKey,
    };
  });
  const currentPeriod = fundingPeriods.find((p) => p.isCurrent) ?? null;
  const upcomingPeriods = fundingPeriods.filter((p) => p.key > currentPeriodKey).slice(0, 2);

  const budgets: OverviewBudget[] = vsBudgets.valueStreams.map((b) => ({
    valueStreamId: b.valueStreamId,
    name: b.name,
    total: b.total,
    currentPeriod: b.byPeriod[currentPeriodKey] ?? 0,
    byPeriod: b.byPeriod,
  }));

  // Headline numbers across the whole horizon — Hero/Executive variants read
  // these for their KPI strips.
  const poolTotal = fundingPeriods.reduce((s, p) => s + p.pool, 0);
  const poolAllocated = fundingPeriods.reduce((s, p) => s + p.allocated, 0);
  const poolFree = Math.max(0, poolTotal - poolAllocated);

  const activePis: OverviewActivePi[] = activePisRaw.map((p) => ({
    id: p.id,
    name: p.name,
    endDate: p.endDate,
    daysRemaining: Math.max(
      0,
      Math.ceil((new Date(p.endDate).getTime() - nowMs) / (24 * 60 * 60 * 1000)),
    ),
  }));
  const nearestPiEnd = activePis[0] ?? null;

  // Recent activity: top 5 most recently touched epics, regardless of status.
  const recentActivity: OverviewRecentEvent[] = [...cards]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title,
      stageGate: c.stageGate,
      status: c.status,
      updatedAt: c.updatedAt,
      valueStreamName: c.valueStream?.name ?? null,
    }));

  // Coaching layer reuses the transformation recommendation engine.
  const nextSteps = deriveNextSteps(structureGap, practiceAdoption);

  return {
    epics: cards,
    epicsByGate,
    epicsCount: cards.length,
    oldestPerGate,
    doneInLast90Days,
    funnelConversion,
    staleEpics,
    blockedEpics,
    impedimentsOpen,
    goals,
    goalsOnTrack,
    goalAverageProgress,
    topGoal,
    budgets,
    poolTotal,
    poolAllocated,
    poolFree,
    valueStreamCount: vsBudgets.valueStreams.length,
    funding: {
      currentPeriodKey,
      periods: fundingPeriods,
      currentPeriod,
      upcomingPeriods,
    },
    activePis,
    nearestPiEnd,
    recentActivity,
    nextSteps,
  };
}

/**
 * Loads every input the Portfolio Overview page-model needs in one parallel
 * wave. Pure I/O — no reshape, no business derivation. The companion builder
 * `buildPortfolioOverviewModel` (above) owns the reshape; this loader exists
 * separately so the builder is testable against in-memory fixtures.
 */
export async function loadPortfolioOverviewInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioOverviewInputs> {
  const [epics, strategyTree, board, vsBudgets, arts, activePis, structureGap, practiceAdoption] =
    await Promise.all([
      listEpics(db, tenantId),
      loadStrategyTree(db, tenantId),
      getBudgetingBoard(db, tenantId),
      getValueStreamBudgets(db, tenantId),
      db.art.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true },
      }),
      db.programIncrement.findMany({
        where: { tenantId, status: "active" },
        select: { id: true, name: true, endDate: true },
        orderBy: { endDate: "asc" },
      }),
      computeStructureGap(db, tenantId),
      computePracticeAdoption(db, tenantId),
    ]);

  // ThemeEpicLink-Bridge ist V2-schema-ready, hat aber noch keine UI-Pflege —
  // bis dahin koennen Themes keine direkten Epic-Links zaehlen. Zeigt als 0.
  const themes: PortfolioOverviewTheme[] = strategyTree.themes.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    trio: t.trio,
    epicLinkCount: 0,
  }));

  const artIds = arts.map((a) => a.id as ArtId);
  const impedimentRows =
    artIds.length === 0
      ? []
      : await listImpedimentsForArts(db, tenantId, artIds, { status: "open" });

  return {
    epics,
    themes,
    board,
    vsBudgets,
    activePis,
    impedimentsOpen: impedimentRows.length,
    structureGap,
    practiceAdoption,
    now: new Date(),
  };
}

/**
 * Convenience wrapper: load + build, returned as one DTO. The page calls this;
 * tests prefer `buildPortfolioOverviewModel` with fixtures.
 */
export async function loadPortfolioOverview(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioOverview> {
  return buildPortfolioOverviewModel(await loadPortfolioOverviewInputs(db, tenantId));
}
