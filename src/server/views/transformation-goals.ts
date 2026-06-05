import { goalKpiProgress } from "@/server/services/transformation";
import { ragTier, type RagTier } from "@/domain/transformation-delta";

/**
 * Strategische-Ziele page-model — turns the loaded Prisma rows (goals + their
 * KPIs + epicLinks, unbound outcomes, epic options, user options) into the
 * render-ready shape the master-detail list + detail-pane UI consumes.
 *
 * Each goal carries its RAG tier (derived from mean KPI progress + status)
 * and its KPIs in full editor shape (so the right-pane editor renders straight
 * from server data — no client-side reshape). Unbound KPIs are split out so
 * the list can group them under "Ohne Ziel". Dates are serialised to ISO-day
 * strings; everything else is structural.
 */

/** One editable KPI (TargetOutcome) row — drives the in-place editor. */
export interface KpiEditorData {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  /** ISO-day string or null. The Input type="date" reads/writes the same shape. */
  dueDate: string | null;
  /** null = unbound (lives in the "Ohne Ziel" group). */
  goalId: string | null;
}

/** One Epic linked to a goal, summarised. */
export interface LinkedEpicView {
  id: string;
  title: string;
  status: string;
}

/** One goal — list row + detail editor read the same shape. */
export interface GoalEditorView {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  /** ISO-day string or null. */
  dueDate: string | null;
  status: string;
  /** RAG tier — `done` when status is "achieved", else by KPI progress. */
  tier: RagTier;
  /** Mean of bound KPI progress (0..1). 0 when no KPIs are bound. */
  kpiProgress: number;
  kpis: KpiEditorData[];
  epics: LinkedEpicView[];
}

export interface EpicOption {
  id: string;
  title: string;
}

export interface UserOption {
  id: string;
  label: string;
}

export interface GoalsPageModel {
  goals: GoalEditorView[];
  unboundKpis: KpiEditorData[];
  epicOptions: EpicOption[];
  userOptions: UserOption[];
}

// ---- Input row types (subset of the Prisma rows that listGoals/listEpics/… load) ----

interface GoalKpiRow {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number;
  current: number | null;
  dueDate: Date | null;
}

interface GoalEpicLinkRow {
  epic: { id: string; title: string; status: string };
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: Date | null;
  status: string;
  kpis: GoalKpiRow[];
  epicLinks: GoalEpicLinkRow[];
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

interface EpicRow {
  id: string;
  title: string;
}

const isoDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Shape a Prisma outcome row into the editor DTO. */
function toKpiEditorData(o: OutcomeRow): KpiEditorData {
  return {
    id: o.id,
    title: o.title,
    metricUnit: o.metricUnit,
    baseline: o.baseline,
    target: o.target,
    current: o.current,
    dueDate: isoDay(o.dueDate),
    goalId: o.goalId,
  };
}

export function buildGoalsPageModel(input: {
  goals: readonly GoalRow[];
  outcomes: readonly OutcomeRow[];
  epics: readonly EpicRow[];
  userLabels: Readonly<Record<string, string>>;
}): GoalsPageModel {
  const { goals, outcomes, epics, userLabels } = input;

  // Group bound outcomes by goal — the goal carries its own KPI list inline.
  const boundByGoal = new Map<string, KpiEditorData[]>();
  const unboundKpis: KpiEditorData[] = [];
  for (const o of outcomes) {
    const dto = toKpiEditorData(o);
    if (o.goalId == null) {
      unboundKpis.push(dto);
    } else {
      const list = boundByGoal.get(o.goalId) ?? [];
      list.push(dto);
      boundByGoal.set(o.goalId, list);
    }
  }

  const goalViews: GoalEditorView[] = goals.map((g) => {
    // Prefer the outcome rows (carry goalId + dueDate) over g.kpis (which lack
    // dueDate in the include shape). When the outcomes list doesn't have one
    // yet (lag between two queries), fall back to g.kpis.
    const kpis =
      boundByGoal.get(g.id) ??
      g.kpis.map((k) => ({
        id: k.id,
        title: k.title,
        metricUnit: k.metricUnit,
        baseline: k.baseline,
        target: k.target,
        current: k.current,
        dueDate: isoDay(k.dueDate),
        goalId: g.id,
      }));
    const progress = goalKpiProgress(
      kpis.map((k) => ({ baseline: k.baseline, target: k.target, current: k.current })),
    );
    return {
      id: g.id,
      title: g.title,
      description: g.description,
      ownerId: g.ownerId,
      dueDate: isoDay(g.dueDate),
      status: g.status,
      tier: ragTier(progress, g.status === "achieved"),
      kpiProgress: progress,
      kpis,
      epics: g.epicLinks.map((l) => ({
        id: l.epic.id,
        title: l.epic.title,
        status: l.epic.status,
      })),
    };
  });

  return {
    goals: goalViews,
    unboundKpis,
    epicOptions: epics.map((e) => ({ id: e.id, title: e.title })),
    userOptions: Object.entries(userLabels).map(([id, label]) => ({ id, label })),
  };
}
