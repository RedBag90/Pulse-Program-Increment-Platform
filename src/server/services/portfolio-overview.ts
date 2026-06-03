import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId } from "@/domain/types";
import type { InitiativeLevel } from "@/domain/types";
import { listEpics } from "@/server/services/epic";
import { listGoals } from "@/server/services/target-goal";
import { getBudgetingBoard, getValueStreamBudgets } from "@/server/services/budgeting";
import { listImpedimentsForArts } from "@/server/services/impediment";
import { halfYearKey } from "@/domain/calendar";
import {
  goalKpiProgress,
  computeStructureGap,
  computePracticeAdoption,
  deriveNextSteps,
  type NextStep,
} from "@/server/services/transformation";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Stage gate keys, in canonical Funnel→Done order. */
export const STAGE_GATES = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type StageGate = (typeof STAGE_GATES)[number];

export const STAGE_GATE_LABEL: Record<StageGate, string> = {
  L0: "Funnel",
  L1: "Hypothesis Stage",
  L2: "Analyzing",
  L3: "Portfolio Backlog",
  L4: "Implementing",
  L5: "Done",
};

/** A Stage on the Portfolio Kanban — Epic card data minus the heavy fields. */
export interface OverviewEpicCard {
  id: string;
  title: string;
  status: string;
  stageGate: string;
  valueStream: { id: string; name: string } | null;
  updatedAt: Date;
  /** Approximate days since the last update on this Epic — used as a proxy for
   *  "days in stage" until we have explicit stage-entry timestamps. */
  daysSinceUpdate: number;
  /** Governance: flagged for the next Steering meeting — surfaced as an amber
   *  highlight on the Portfolio Kanban so the agenda is visible at a glance. */
  needsSteeringAttention: boolean;
}

export interface OverviewGoal {
  id: string;
  title: string;
  status: string;
  progress: number;
  epicLinkCount: number;
}

export interface OverviewBudget {
  valueStreamId: string;
  name: string;
  /** Σ across every half-year on the budgeting axis. */
  total: number;
  /** Σ allocated to this Value Stream in the current half-year. */
  currentPeriod: number;
  /** Per-period allocations, keyed `YYYY-H1` / `YYYY-H2`. */
  byPeriod: Record<string, number>;
}

/** One half-year on the budgeting horizon — pool vs allocated. */
export interface OverviewFundingPeriod {
  key: string; // "2026-H1"
  label: string; // "H1 2026"
  pool: number;
  allocated: number;
  /** pool − allocated; negative ⇒ over-allocated. */
  remaining: number;
  isCurrent: boolean;
  isPast: boolean;
}

export interface OverviewFunding {
  currentPeriodKey: string;
  /** Every half-year on the axis, oldest first. */
  periods: OverviewFundingPeriod[];
  /** The half-year that "today" falls into, or null when missing from the axis. */
  currentPeriod: OverviewFundingPeriod | null;
  /** Next two half-years after the current one — for a forward-look strip. */
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

  // Pipeline aggregates
  oldestPerGate: Record<StageGate, OverviewEpicCard | null>;
  doneInLast90Days: number;
  funnelConversion: number; // 0..1 — Done90 / (Done90 + Funnel)

  // Health
  staleEpics: OverviewEpicCard[];
  blockedEpics: OverviewEpicCard[];
  impedimentsOpen: number;

  // Strategy
  goals: OverviewGoal[];
  goalsOnTrack: number;
  goalAverageProgress: number;
  topGoal: OverviewGoal | null;

  // Funding
  budgets: OverviewBudget[];
  poolTotal: number;
  poolAllocated: number;
  poolFree: number;
  valueStreamCount: number;
  funding: OverviewFunding;

  // Time context
  activePis: OverviewActivePi[];
  nearestPiEnd: OverviewActivePi | null;

  // Activity feed
  recentActivity: OverviewRecentEvent[];

  // Coaching
  nextSteps: NextStep[];
}

/**
 * Single-call assembler for the Portfolio "Übersicht". Bundles every aggregate
 * the three overview variants (Mission Control, Hero, Executive) need into one
 * parallel fetch wave. Pure read; no mutations, no transactions.
 *
 * Reuses the existing service surface intentionally — every aggregate here is
 * a thin re-shape of `listEpics`, `listGoals`, `getValueStreamBudgets`,
 * `listImpedimentsForArts`, and `computeStructureGap`/`computePracticeAdoption`.
 */
export async function getPortfolioOverview(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioOverview> {
  const [epics, goalsRaw, board, vsBudgets, arts, activePisRaw, structureGap, practiceAdoption] =
    await Promise.all([
      listEpics(db, tenantId),
      listGoals(db, tenantId),
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

  const now = Date.now();
  const cards: OverviewEpicCard[] = epics.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    stageGate: e.stageGate,
    valueStream: e.valueStream,
    updatedAt: e.updatedAt,
    daysSinceUpdate: Math.floor((now - new Date(e.updatedAt).getTime()) / (24 * 60 * 60 * 1000)),
    needsSteeringAttention: e.needsSteeringAttention,
  }));

  // Group epics by stage gate, oldest-first per column so the kanban renders
  // the slowest items at the top of each list.
  const epicsByGate = Object.fromEntries(
    STAGE_GATES.map((g) => [g, [] as OverviewEpicCard[]]),
  ) as Record<StageGate, OverviewEpicCard[]>;
  for (const c of cards) {
    const gate = (STAGE_GATES as readonly string[]).includes(c.stageGate)
      ? (c.stageGate as StageGate)
      : null;
    if (gate) epicsByGate[gate].push(c);
  }
  for (const gate of STAGE_GATES) {
    epicsByGate[gate].sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  }

  const oldestPerGate = Object.fromEntries(
    STAGE_GATES.map((g) => [g, epicsByGate[g][0] ?? null]),
  ) as Record<StageGate, OverviewEpicCard | null>;

  // L5 (Done) epics whose last update is within 90 days serve as a coarse
  // throughput proxy until we have explicit stage-entry timestamps.
  const doneInLast90Days = cards.filter(
    (c) => c.stageGate === "L5" && now - new Date(c.updatedAt).getTime() <= NINETY_DAYS_MS,
  ).length;
  const funnelCount = epicsByGate.L0.length;
  const funnelConversion =
    doneInLast90Days + funnelCount === 0 ? 0 : doneInLast90Days / (doneInLast90Days + funnelCount);

  const staleEpics = cards.filter(
    (c) =>
      now - new Date(c.updatedAt).getTime() > THIRTY_DAYS_MS &&
      c.status !== "completed" &&
      c.status !== "cancelled",
  );
  const blockedEpics = cards.filter((c) => c.status === "blocked");

  // Strategy
  const goals: OverviewGoal[] = goalsRaw.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    progress: goalKpiProgress(g.kpis),
    epicLinkCount: g.epicLinks.length,
  }));
  const activeGoals = goals.filter((g) => g.status === "active");
  const goalAverageProgress =
    activeGoals.length === 0
      ? 0
      : activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length;
  const goalsOnTrack = activeGoals.filter((g) => g.progress >= 0.5).length;
  const topGoal =
    activeGoals.length === 0 ? null : [...activeGoals].sort((a, b) => b.progress - a.progress)[0]!;

  // Funding — derive pool vs allocated per half-year. The pool lives on the
  // tenant (`budgetPoolByPeriod`); allocations come from per-Epic budget rows
  // rolled up by Value Stream. Together they form the funding aggregate.
  const currentPeriodKey = halfYearKey(new Date());
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

  // Active PIs + impediments aggregated across every ART.
  const artIds = arts.map((a) => a.id as ArtId);
  const impedimentRows =
    artIds.length === 0
      ? []
      : await listImpedimentsForArts(db, tenantId, artIds, { status: "open" });
  const impedimentsOpen = impedimentRows.length;

  const activePis: OverviewActivePi[] = activePisRaw.map((p) => ({
    id: p.id,
    name: p.name,
    endDate: p.endDate,
    daysRemaining: Math.max(
      0,
      Math.ceil((new Date(p.endDate).getTime() - now) / (24 * 60 * 60 * 1000)),
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

// Helper: counts non-deleted Features in a given level — kept here so the
// overview can include legacy "by-level" KPIs if the Hero variant ever needs
// them again. Currently unused; left exported for the next iteration.
export async function countInitiativesAtLevel(
  db: PrismaClient,
  tenantId: TenantId,
  level: InitiativeLevel,
): Promise<number> {
  return db.initiative.count({
    where: { tenantId, level, deletedAt: null },
  });
}
