import { goalKpiProgress, deriveNextSteps } from "@/server/services/transformation";
import type { StructureGap, PracticeAdoption, NextStep } from "@/server/services/transformation";
import { sparklinePoints } from "@/server/services/transformation-snapshot";
import {
  effectivePractices,
  type PracticeFlags,
  type OperatingModelTemplate,
} from "@/domain/operating-model";
import {
  ragTier,
  recentChanges,
  type RagTier,
  type RecentChange,
} from "@/domain/transformation-delta";
/**
 * Goal-unbound outcome as the cockpit's "Outcomes (frei)" panel renders it.
 * Previously declared in the (now-deleted) `<TargetOutcomesManager>` file;
 * moved here so the cockpit + its consumers don't depend on a UI-layer file
 * for the type. The richer editor-shaped DTO lives in `transformation-goals`.
 */
export interface OutcomeView {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  dueDate: string | null;
}

/**
 * Transformation cockpit page-model — assembles the render-ready props the
 * cockpit consumes. Compared to the bar-list cockpit this superseded, the
 * model now owns:
 *
 * - the hero "Soll-Reife" (snapshot metric, single number, no more dual
 *   50%/62% ambiguity at the top of the page),
 * - per-goal RAG tier + the goal's bound outcomes (the goal-card popover
 *   needs them to render inline "Update KPI" forms),
 * - structure + practice **chips** (replacing the four stacked-bar sections)
 *   each carrying its own tier,
 * - the "Seit letztem Snapshot" `recentChanges` story (delta vs the previous
 *   snapshot, ranked, capped at 4),
 * - the `nextSteps` coaching list (moved here from inside the cockpit so the
 *   action drawer renders straight from server data).
 *
 * Goal-bound KPIs go on the goal card; only goal-unbound outcomes show in the
 * "Outcomes (frei)" section at the bottom of the page. `goalAchievement` is
 * still NOT recomputed here — the hero uses the snapshot metric; per-goal
 * progress uses `goalKpiProgress` (different scopes, intentionally distinct
 * per ADR-0001, but now both are labelled per their scope).
 */

const TREND_W = 280;
const TREND_H = 48;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

interface GoalKpiRow {
  baseline: number | null;
  target: number;
  current: number | null;
}

interface GoalRow {
  id: string;
  title: string;
  status: string;
  kpis: GoalKpiRow[];
  epicLinks: readonly unknown[];
}

interface SnapshotRow {
  capturedOn: Date;
  goalAchievement: number;
  structureProgress: number;
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

/** The declared target operating model, summarised for the cockpit header. */
export interface ModelSummary {
  template: OperatingModelTemplate | null;
  status: string;
  targetDate: string | null;
  practices: PracticeFlags;
}

/**
 * A goal's KPI bar on the goal card. Same shape as `OutcomeView` so the card
 * can reuse outcome-row rendering helpers, but kept distinct because the
 * card's inline "Update KPI" popover needs identity (id + title) that the
 * read-only `OutcomeView` already carries.
 */
export interface GoalBoundOutcome {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
}

/** A strategic goal as the cockpit's RAG card consumes it. */
export interface GoalCard {
  id: string;
  title: string;
  status: string;
  /** RAG tier — `done` when status is "achieved", else derived from KPI progress. */
  tier: RagTier;
  /** Mean KPI progress over this goal's outcomes (0 when no KPIs are bound). */
  kpiProgress: number;
  kpiCount: number;
  epicCount: number;
  /** This goal's bound outcomes — drives the "Update KPI" popover inline form. */
  boundOutcomes: GoalBoundOutcome[];
}

/** A single structure dimension as a chip — Wertströme / ARTs / Teams. */
export interface StructureChip {
  key: string;
  label: string;
  ist: number;
  /** `null` when this dimension is not part of the target. */
  soll: number | null;
  tier: RagTier;
  /** Positive when ist < soll; 0 once the target is met. */
  gap: number;
}

/** A single practice as a chip — WSJF / Feature-QS / PI-Ziele / …. */
export interface PracticeChip {
  key: string;
  label: string;
  /** Adoption ratio (0..1). */
  value: number;
  tier: RagTier;
  /** Detail string from the service (e.g. "95/105 Features bewertet"). */
  detail: string;
}

/** Hero card data — the single headline number + Δ-over-window + target date. */
export interface HeroData {
  /** The snapshot metric "Soll-Reife" (0..1), or 0 when no snapshots exist. */
  sollReife: number;
  /** ISO date string of the active model's target, or null. */
  targetDate: string | null;
  /** Long-window Δ vs the first snapshot in the loaded window, or null. */
  delta: { value: number; days: number } | null;
  /** Did we ever have a snapshot? Drives the hero's "noch keine Erfassung" empty state. */
  hasSnapshot: boolean;
}

/** One snapshot, serialised for the client. */
export interface SnapshotPoint {
  capturedOn: string;
  goalAchievement: number;
  achievedGoalCount: number;
  goalCount: number;
}

/** The "Reise über Zeit" data, prepared server-side for the sparkline. */
export interface TrendData {
  snapshots: SnapshotPoint[];
  points: { x: number; y: number }[];
  viewBox: { width: number; height: number };
  firstAchievement: { capturedOn: string } | null;
}

export interface CockpitModel {
  hero: HeroData;
  model: ModelSummary | null;
  goals: GoalCard[];
  structure: StructureChip[];
  practices: PracticeChip[];
  recentChanges: RecentChange[];
  nextSteps: NextStep[];
  trend: TrendData;
  outcomes: OutcomeView[];
}

/**
 * RAG tier for a structure dimension. Structure is binary on "met or not" —
 * even a 10/12 (83 %) ratio shouldn't read green when there's still a concrete
 * gap to close. Green only when the target is met (or no target exists); a
 * partial ratio ≥ 30 % is amber; below that, red.
 */
function structureTier(ist: number, soll: number | null): RagTier {
  if (soll == null || soll === 0 || ist >= soll) return "green";
  return ist / soll >= 0.3 ? "amber" : "red";
}

export function buildCockpitModel(input: {
  goals: readonly GoalRow[];
  snapshots: readonly SnapshotRow[];
  activeModel: ActiveModelRow | null;
  outcomes: readonly OutcomeRow[];
  gap: StructureGap;
  adoption: PracticeAdoption;
}): CockpitModel {
  const { goals, snapshots, activeModel, outcomes, gap, adoption } = input;

  // Goal cards — active + achieved (archived parked). Each carries its RAG tier
  // and its bound outcomes so the card's "Update KPI" popover renders inline.
  const boundOutcomesByGoal = new Map<string, GoalBoundOutcome[]>();
  for (const o of outcomes) {
    if (!o.goalId) continue;
    const list = boundOutcomesByGoal.get(o.goalId) ?? [];
    list.push({
      id: o.id,
      title: o.title,
      metricUnit: o.metricUnit,
      baseline: o.baseline,
      target: o.target,
      current: o.current,
    });
    boundOutcomesByGoal.set(o.goalId, list);
  }

  const goalCards: GoalCard[] = goals
    .filter((g) => g.status !== "archived")
    .map((g) => {
      const kpiProgress = goalKpiProgress(g.kpis);
      return {
        id: g.id,
        title: g.title,
        status: g.status,
        tier: ragTier(kpiProgress, g.status === "achieved"),
        kpiProgress,
        kpiCount: g.kpis.length,
        epicCount: g.epicLinks.length,
        boundOutcomes: boundOutcomesByGoal.get(g.id) ?? [],
      };
    });

  // Structure chips — flat tiered view of the gap dimensions.
  const structure: StructureChip[] = gap.dimensions.map((d) => ({
    key: d.key,
    label: d.label,
    ist: d.ist,
    soll: d.soll,
    tier: structureTier(d.ist, d.soll),
    gap: d.soll != null ? Math.max(0, d.soll - d.ist) : 0,
  }));

  // Practice chips — tier each enabled signal.
  const practices: PracticeChip[] = adoption.signals.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
    tier: ragTier(s.value),
    detail: s.detail,
  }));

  // "Reise über Zeit": serialise the snapshots and pre-compute sparkline geometry.
  const snapshotPoints: SnapshotPoint[] = snapshots.map((s) => ({
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

  // Hero: the snapshot metric is the single headline number. The long-window
  // delta (vs the first snapshot in the loaded window) is what the user
  // already reads on the sparkline; the per-snapshot delta lives in the
  // "Seit letztem Snapshot" drawer instead.
  const last = snapshots.at(-1);
  const first = snapshots.at(0);
  const hero: HeroData = {
    sollReife: last?.goalAchievement ?? 0,
    targetDate: activeModel?.targetDate ? isoDay(activeModel.targetDate) : null,
    delta:
      last && first && last !== first
        ? {
            value: last.goalAchievement - first.goalAchievement,
            days: Math.round(
              (last.capturedOn.getTime() - first.capturedOn.getTime()) / (1000 * 60 * 60 * 24),
            ),
          }
        : null,
    hasSnapshot: snapshots.length > 0,
  };

  // "Seit letztem Snapshot" — what moved between the most recent two captures.
  const prev = snapshots.at(-2) ?? null;
  const changes = recentChanges(prev ?? null, last ?? null);

  const model: ModelSummary | null = activeModel
    ? {
        template: (activeModel.template as OperatingModelTemplate | null) ?? null,
        status: activeModel.status,
        targetDate: activeModel.targetDate ? isoDay(activeModel.targetDate) : null,
        practices: effectivePractices(activeModel),
      }
    : null;

  // Goal-bound KPIs render under their goal card; only unbound outcomes go to
  // the bottom "Outcomes (frei)" panel.
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

  return {
    hero,
    model,
    goals: goalCards,
    structure,
    practices,
    recentChanges: changes,
    nextSteps: deriveNextSteps(gap, adoption),
    trend,
    outcomes: outcomeViews,
  };
}
