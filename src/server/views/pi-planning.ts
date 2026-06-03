import type { Prisma } from "@/generated/prisma";
import type { PlanningFeature } from "@/features/pi/components/feature-planning-board";
import type { TablePi } from "@/features/pi/components/feature-planning-table";
import {
  computeCapacity,
  computeDemand,
  utilizationBand,
  combineBands,
  type UtilizationBand,
} from "@/domain/pi-capacity";
import { earliestStartFromBlockers, type BlockerWindow } from "@/domain/dependency-graph";

/**
 * PI-planning page-model — reshapes the loaded ART PIs + Features into the
 * render-ready props the board and table consume (flattening the sprint count,
 * converting the WSJF `Decimal`, picking the epic title). Pure, so the page is
 * load → build → render and the reshaping is tested here rather than in the
 * server component.
 *
 * Also computes the per-PI capacity overlay (Job Size + €) — demand from the
 * Features' Job Size and capacity from the PI override or, when absent, the
 * ART budget prorated to the PI's calendar window.
 */

/** A loaded PI row (from `listArtPlanningPis`) — structural. */
export interface PlanningPiRow {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  capacityJobSize: number | null;
  capacityAmount: Prisma.Decimal | number | null;
  _count: { sprints: number };
}

/** A loaded Feature row (from `listFeatures`) — structural. */
export interface PlanningFeatureRow {
  id: string;
  title: string;
  status: string;
  wsjfComputed: Prisma.Decimal | number | null;
  wsjfJobSize: number | null;
  parent: { id: string; title: string } | null;
  piId: string | null;
}

/** Per-PI capacity overlay derived for the column header. */
export interface PiCapacityOverlay {
  piId: string;
  jobSizeDemand: number;
  jobSizeCapacity: number | null;
  amountDemand: number | null;
  amountCapacity: number | null;
  amountSource: "override" | "prorated" | null;
  band: UtilizationBand;
}

/** Per-Feature blocker overlay — drives the earliest-PI chip on each card. */
export interface FeatureBlockerOverlay {
  /** Earliest start derived from the latest blocker's PI endDate (UTC midnight). */
  earliestStart: Date | null;
  /** The id of the earliest PI that satisfies the constraint (same ART, not completed). */
  earliestPiId: string | null;
  /** Human label of the earliest PI (e.g. "PI 2026.2"); null when no scheduled PI fits. */
  earliestPiName: string | null;
  /** Titles of unscheduled blockers — UI uses them in the hover hint. */
  unscheduledBlockerTitles: string[];
  /** Titles of the scheduled blockers (max 3, for the chip tooltip). */
  scheduledBlockerTitles: string[];
  /** True when the Feature's current PI sits before `earliestStart`. */
  violates: boolean;
}

export interface PlanningModel {
  pis: TablePi[];
  features: PlanningFeature[];
  /** Keyed by PI id. Missing entries mean "no overlay" (rare; only when a PI vanishes mid-build). */
  capacity: Record<string, PiCapacityOverlay>;
  /** Keyed by Feature id. Only Features with at least one blocker carry an entry. */
  blockers: Record<string, FeatureBlockerOverlay>;
  /** Tenant-wide €/Job-Size constant; null when the €-axis is disabled. */
  costPerJobSizePoint: number | null;
}

export interface BuildPlanningModelInputs {
  pis: readonly PlanningPiRow[];
  features: readonly PlanningFeatureRow[];
  /** ART-budget cells keyed by half-year (`"YYYY-H1" / "-H2"`); `null` when no ArtBudget row exists. */
  artBudgetByPeriod: Record<string, number> | null;
  /** Tenant conversion rate; `null` hides the €-axis. */
  costPerJobSizePoint: number | null;
  /** Direct blockers per Feature (one entry per blocker); empty map for "no blockers". */
  blockerWindowsByFeature: Map<string, readonly BlockerWindow[]>;
  /** Earliest funded half-year key per parent-Epic id, or `null` for "no budget".
   *  Missing entries are treated as `null` (= "Ohne Budget" in the Backlog). */
  epicCycleByEpicId?: Record<string, string | null>;
}

export function buildPlanningModel(inputs: BuildPlanningModelInputs): PlanningModel {
  const {
    pis,
    features,
    artBudgetByPeriod,
    costPerJobSizePoint,
    blockerWindowsByFeature,
    epicCycleByEpicId,
  } = inputs;
  const planningFeatures: PlanningFeature[] = features.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    wsjf: Number(f.wsjfComputed ?? 0),
    epicId: f.parent?.id ?? null,
    epicTitle: f.parent?.title ?? null,
    cycleKey: f.parent?.id ? (epicCycleByEpicId?.[f.parent.id] ?? null) : null,
    piId: f.piId,
  }));

  const demandRows = features.map((f) => ({
    piId: f.piId,
    wsjfJobSize: f.wsjfJobSize,
  }));

  const tablePis: TablePi[] = [];
  const capacity: Record<string, PiCapacityOverlay> = {};

  for (const p of pis) {
    tablePis.push({
      id: p.id,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      sprintCount: p._count.sprints,
    });

    const cap = computeCapacity(
      {
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        capacityJobSize: p.capacityJobSize,
        capacityAmount: p.capacityAmount != null ? Number(p.capacityAmount) : null,
      },
      artBudgetByPeriod,
    );
    const demand = computeDemand(demandRows, p.id, costPerJobSizePoint);
    const jobBand = utilizationBand(demand.jobSizeSum, cap.capacityJobSize);
    const amountBand =
      demand.amountSum !== null ? utilizationBand(demand.amountSum, cap.capacityAmount) : "ok";

    capacity[p.id] = {
      piId: p.id,
      jobSizeDemand: demand.jobSizeSum,
      jobSizeCapacity: cap.capacityJobSize,
      amountDemand: demand.amountSum,
      amountCapacity: cap.capacityAmount,
      amountSource: cap.capacityAmountSource,
      band: combineBands(jobBand, amountBand),
    };
  }

  // Cache PI lookups for the earliest-PI mapping below.
  const pisByStart = [...pis]
    .filter((p) => p.status !== "completed")
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const piById = new Map(pis.map((p) => [p.id, p]));

  const blockers: Record<string, FeatureBlockerOverlay> = {};
  for (const f of features) {
    const ws = blockerWindowsByFeature.get(f.id);
    if (!ws || ws.length === 0) continue;

    const { earliest, unscheduledBlockers } = earliestStartFromBlockers(ws);
    const scheduledTitles = ws
      .filter((w) => w.blockerEndDate !== null)
      .slice(0, 3)
      .map((w) => w.blockerTitle);

    // Earliest non-completed PI whose startDate ≥ earliest blocker end.
    let earliestPiId: string | null = null;
    let earliestPiName: string | null = null;
    if (earliest) {
      const fit = pisByStart.find((p) => p.startDate >= earliest);
      if (fit) {
        earliestPiId = fit.id;
        earliestPiName = fit.name;
      }
    }

    // Violation only meaningful when both the Feature has a current PI and an
    // earliest date is known. Compare against the *current* PI's startDate —
    // assigning a Feature to a PI that starts before its blockers end is the
    // condition we want to warn on.
    let violates = false;
    if (earliest && f.piId) {
      const current = piById.get(f.piId);
      if (current && current.startDate < earliest) violates = true;
    }

    blockers[f.id] = {
      earliestStart: earliest,
      earliestPiId,
      earliestPiName,
      unscheduledBlockerTitles: unscheduledBlockers,
      scheduledBlockerTitles: scheduledTitles,
      violates,
    };
  }

  return {
    pis: tablePis,
    features: planningFeatures,
    capacity,
    blockers,
    costPerJobSizePoint,
  };
}

// ---------------------------------------------------------------------------
// Backlog grouping (Cycle → Epic) — shared by Board and Table.
// ---------------------------------------------------------------------------

/** Earliest half-year key with money > 0, or null when nothing is funded. */
export function earliestFundedCycle(allocations: Record<string, number>): string | null {
  const funded = Object.entries(allocations)
    .filter(([, v]) => v > 0)
    .map(([k]) => k)
    .sort();
  return funded[0] ?? null;
}

/** Synthetic key for Features whose Epic has no funded period (or no Epic). */
export const NO_BUDGET_CYCLE = "__none__";
/** Synthetic key for Features without a parent Epic (extremely rare). */
export const NO_EPIC = "__noepic__";

export interface BacklogEpicGroup {
  epicId: string | typeof NO_EPIC;
  epicTitle: string | null;
  features: PlanningFeature[];
  wsjfSum: number;
}

export interface BacklogCycleGroup {
  cycleKey: string | typeof NO_BUDGET_CYCLE;
  isCurrent: boolean;
  count: number;
  wsjfSum: number;
  epics: BacklogEpicGroup[];
}

/**
 * Two-level grouping for the Backlog column/row: outer = budgeting half-year
 * (current cycle first, then chronological, "Ohne Budget" last), inner = Epic
 * (sorted by Σ WSJF of the backlog slice). Features within each Epic keep the
 * caller's order (the caller already sorts by WSJF desc).
 *
 * Pure — `now` is injected so tests can pin the "current cycle" deterministically.
 */
export function groupBacklogByCycleAndEpic(
  features: readonly PlanningFeature[],
  currentCycleKey: string,
): BacklogCycleGroup[] {
  const byCycle = new Map<string, Map<string, PlanningFeature[]>>();
  for (const f of features) {
    const ck = f.cycleKey ?? NO_BUDGET_CYCLE;
    const ek = f.epicId ?? NO_EPIC;
    let epicMap = byCycle.get(ck);
    if (!epicMap) {
      epicMap = new Map();
      byCycle.set(ck, epicMap);
    }
    const bucket = epicMap.get(ek) ?? [];
    bucket.push(f);
    epicMap.set(ek, bucket);
  }

  const cycleKeys = [...byCycle.keys()].sort((a, b) => {
    if (a === b) return 0;
    if (a === currentCycleKey) return -1;
    if (b === currentCycleKey) return 1;
    if (a === NO_BUDGET_CYCLE) return 1;
    if (b === NO_BUDGET_CYCLE) return -1;
    return a < b ? -1 : 1;
  });

  return cycleKeys.map((ck) => {
    const epicMap = byCycle.get(ck)!;
    const cycleFeatures = [...epicMap.values()].flat();
    const wsjfSum = cycleFeatures.reduce((s, f) => s + f.wsjf, 0);

    const epicEntries: BacklogEpicGroup[] = [...epicMap.entries()].map(([ek, list]) => ({
      epicId: ek === NO_EPIC ? NO_EPIC : ek,
      epicTitle: list[0]?.epicTitle ?? null,
      features: list,
      wsjfSum: list.reduce((s, f) => s + f.wsjf, 0),
    }));
    epicEntries.sort((a, b) => b.wsjfSum - a.wsjfSum);

    return {
      cycleKey: ck === NO_BUDGET_CYCLE ? NO_BUDGET_CYCLE : ck,
      isCurrent: ck === currentCycleKey,
      count: cycleFeatures.length,
      wsjfSum,
      epics: epicEntries,
    };
  });
}
