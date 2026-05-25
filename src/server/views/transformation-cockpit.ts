import { goalKpiProgress } from "@/server/services/transformation";
import { sparklinePoints } from "@/server/services/transformation-snapshot";
import {
  effectivePractices,
  type PracticeFlags,
  type OperatingModelTemplate,
} from "@/domain/operating-model";
import type {
  ModelSummary,
  GoalSummary,
  TrendData,
} from "@/features/transformation/components/transformation-cockpit";
import type { OutcomeView } from "@/features/transformation/components/target-outcomes-manager";

/**
 * Transformation cockpit page-model — assembles the render-ready props the
 * cockpit consumes from the loaded goals, snapshots, target model and outcomes:
 * the active-goal summaries (KPI progress + counts), the "Reise über Zeit" trend
 * (snapshot points + sparkline geometry), the model summary and the
 * goal-unbound outcome views. Pure, so the page is load → build → render and the
 * filtering / serialisation is tested here, not in the server component.
 *
 * NB: `goalAchievement` is *not* recomputed here — the cockpit derives its own
 * live number and the snapshot trend carries the persisted one; these are two
 * intentional metrics (ADR-0001).
 */

const TREND_W = 280;
const TREND_H = 48;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

interface GoalRow {
  id: string;
  title: string;
  status: string;
  kpis: { baseline: number | null; target: number; current: number | null }[];
  epicLinks: readonly unknown[];
}

interface SnapshotRow {
  capturedOn: Date;
  goalAchievement: number;
  achievedGoalCount: number;
  goalCount: number;
}

/** The active target model — carries the practice flags `effectivePractices` reads. */
interface ActiveModelRow extends Partial<PracticeFlags> {
  template: string | null;
  status: string;
  targetDate: Date | null;
}

interface OutcomeRow {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  dueDate: Date | null;
  goalId: string | null;
}

export interface CockpitModel {
  model: ModelSummary | null;
  goals: GoalSummary[];
  trend: TrendData;
  outcomes: OutcomeView[];
}

export function buildCockpitModel(input: {
  goals: readonly GoalRow[];
  snapshots: readonly SnapshotRow[];
  activeModel: ActiveModelRow | null;
  outcomes: readonly OutcomeRow[];
}): CockpitModel {
  const { goals, snapshots, activeModel, outcomes } = input;

  // The cockpit shows the active strategic goals (archived ones are parked).
  const goalSummaries: GoalSummary[] = goals
    .filter((g) => g.status !== "archived")
    .map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      kpiProgress: goalKpiProgress(g.kpis),
      kpiCount: g.kpis.length,
      epicCount: g.epicLinks.length,
    }));

  // "Reise über Zeit": serialise the snapshots and pre-compute sparkline geometry.
  const snapshotPoints = snapshots.map((s) => ({
    capturedOn: isoDay(s.capturedOn),
    goalAchievement: s.goalAchievement,
    achievedGoalCount: s.achievedGoalCount,
    goalCount: s.goalCount,
  }));
  const firstAchieved = snapshots.find((s) => s.achievedGoalCount > 0);
  const trend: TrendData = {
    snapshots: snapshotPoints,
    points: sparklinePoints(
      snapshots.map((s) => s.goalAchievement),
      TREND_W,
      TREND_H,
    ),
    viewBox: { width: TREND_W, height: TREND_H },
    firstAchievement: firstAchieved ? { capturedOn: isoDay(firstAchieved.capturedOn) } : null,
  };

  const model: ModelSummary | null = activeModel
    ? {
        template: (activeModel.template as OperatingModelTemplate | null) ?? null,
        status: activeModel.status,
        targetDate: activeModel.targetDate ? isoDay(activeModel.targetDate) : null,
        practices: effectivePractices(activeModel),
      }
    : null;

  // Goal-bound KPIs show under their goal; only unbound outcomes go to the panel.
  const outcomeViews: OutcomeView[] = outcomes
    .filter((o) => o.goalId == null)
    .map((o) => ({
      id: o.id,
      title: o.title,
      metricUnit: o.metricUnit,
      baseline: o.baseline,
      target: o.target,
      current: o.current,
      dueDate: o.dueDate ? isoDay(o.dueDate) : null,
    }));

  return { model, goals: goalSummaries, trend, outcomes: outcomeViews };
}
