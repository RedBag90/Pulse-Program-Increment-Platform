import { deriveNextSteps } from "@/server/services/transformation";
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
 * Transformation-Maturity-Cockpit (Pflege-Reife des Zielmodells).
 *
 * Nach P0-P5 lebt der Strategie-Layer (Themes/OKRs/KRs/€-Rollup)
 * unter `/ziele`; das Cockpit hier beschraenkt sich auf den
 * Operating-Model-Reifegrad: Soll-Reife-Hero, Strukturfortschritt,
 * Praktiken, Snapshots-Trend, Coaching-Next-Steps. Strategische
 * Ziele sind aus dem Modell entfernt — die alten `GoalCard`s sind
 * dauerhaft im Ziele-Modul; dieses Cockpit zeigt nur noch einen
 * Deep-Link.
 *
 * `goalAchievement` an `TransformationSnapshot` bleibt als
 * historische Reifegrad-Kennzahl: vergangene Snapshots wurden mit
 * dem damaligen Goal-KPI-Mittel geschrieben; das ist die
 * Soll-Reife-Linie im Hero.
 */

const TREND_W = 280;
const TREND_H = 48;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

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

/** The declared target operating model, summarised for the cockpit header. */
export interface ModelSummary {
  template: OperatingModelTemplate | null;
  status: string;
  targetDate: string | null;
  practices: PracticeFlags;
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
  structure: StructureChip[];
  practices: PracticeChip[];
  recentChanges: RecentChange[];
  nextSteps: NextStep[];
  trend: TrendData;
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
  snapshots: readonly SnapshotRow[];
  activeModel: ActiveModelRow | null;
  gap: StructureGap;
  adoption: PracticeAdoption;
}): CockpitModel {
  const { snapshots, activeModel, gap, adoption } = input;

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

  // Hero: snapshot metric is the headline; the long-window Δ vs the first
  // loaded snapshot stays in the hero, per-snapshot Δ in the drawer.
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

  return {
    hero,
    model,
    structure,
    practices,
    recentChanges: changes,
    nextSteps: deriveNextSteps(gap, adoption),
    trend,
  };
}
