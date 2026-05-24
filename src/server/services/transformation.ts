import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import { getStructureTree } from "@/server/services/structure";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices, PRACTICE_LABELS, type Practice } from "@/domain/operating-model";

/**
 * The transformation gap engine — measures the current organisation (Ist)
 * against the management-defined target operating model (Soll). Phase 0 covers
 * the structure dimensions; practice-adoption and outcome gaps follow in Phase 1.
 */

export interface GapDimension {
  key: string;
  label: string;
  ist: number;
  /** Target value; `null` means this dimension is not part of the target. */
  soll: number | null;
  /** 0..1 — capped at 1; 1 when there is no target for the dimension. */
  progress: number;
}

export interface StructureGap {
  hasTarget: boolean;
  targetDate: Date | null;
  dimensions: GapDimension[];
  /** Average progress over the dimensions that carry a target. */
  overallProgress: number;
}

function dimension(key: string, label: string, ist: number, soll: number | null): GapDimension {
  const progress = soll == null || soll === 0 ? 1 : Math.min(1, ist / soll);
  return { key, label, ist, soll, progress };
}

/** Compares structure counts (Wertströme / ARTs / Teams) against the Soll. */
export async function computeStructureGap(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<StructureGap> {
  const model = await getActiveTargetModel(db, tenantId);
  if (!model) {
    return { hasTarget: false, targetDate: null, dimensions: [], overallProgress: 0 };
  }

  const tree = await getStructureTree(db, tenantId);
  const arts = tree.flatMap((vs) => vs.arts);
  const teams = arts.flatMap((a) => a.teams);

  const dimensions = [
    dimension("valueStreams", "Wertströme", tree.length, model.targetValueStreams),
    dimension("arts", "ARTs", arts.length, model.targetArtsTotal),
    dimension("teams", "Teams", teams.length, model.targetTeamsTotal),
  ];

  const withTarget = dimensions.filter((d) => d.soll != null);
  const overallProgress = withTarget.length
    ? withTarget.reduce((sum, d) => sum + d.progress, 0) / withTarget.length
    : 1;

  return { hasTarget: true, targetDate: model.targetDate, dimensions, overallProgress };
}

/** Per-practice adoption rate (0..1) — is an enabled practice actually used? */
export interface AdoptionSignal {
  key: Practice;
  label: string;
  value: number;
  detail: string;
}

export interface PracticeAdoption {
  hasTarget: boolean;
  signals: AdoptionSignal[];
}

function rate(n: number, d: number): number {
  return d === 0 ? 0 : Math.min(1, n / d);
}

/**
 * Adoption signals for the *enabled* behavioural practices — deliberately
 * simple, single-snapshot heuristics (the backlog notes these should iterate).
 * Disabled practices are omitted. Structural levels (portfolio/program) are
 * covered by the structure gap, not here.
 */
export async function computePracticeAdoption(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PracticeAdoption> {
  const model = await getActiveTargetModel(db, tenantId);
  if (!model) return { hasTarget: false, signals: [] };

  const on = effectivePractices(model);
  const feature = { tenantId, level: InitiativeLevel.FEATURE, deletedAt: null } as const;
  const epic = { tenantId, level: InitiativeLevel.EPIC, deletedAt: null } as const;

  const activePis = await db.programIncrement.findMany({
    where: { tenantId, status: "active" },
    select: { id: true },
  });
  const activePiIds = activePis.map((p) => p.id);

  const [
    totalFeatures,
    featuresWsjf,
    featuresApproved,
    totalEpics,
    epicsBeyondFunnel,
    epicsInApproval,
    dependencyCount,
    totalTeams,
    teamsWithObjectives,
  ] = await Promise.all([
    db.initiative.count({ where: feature }),
    db.initiative.count({ where: { ...feature, wsjfComputed: { not: null } } }),
    db.initiative.count({ where: { ...feature, status: "approved" } }),
    db.initiative.count({ where: epic }),
    db.initiative.count({ where: { ...epic, stageGate: { not: "L0" } } }),
    db.initiative.count({ where: { ...epic, approvalPhase: { not: "draft" } } }),
    db.dependency.count({ where: { tenantId } }),
    db.team.count({ where: { tenantId } }),
    activePiIds.length === 0
      ? Promise.resolve([] as { teamId: string }[])
      : db.piObjective.findMany({
          where: { tenantId, piId: { in: activePiIds } },
          select: { teamId: true },
          distinct: ["teamId"],
        }),
  ]);

  const candidates: Record<
    Exclude<Practice, "portfolioLevel" | "programLevel">,
    { value: number; detail: string }
  > = {
    wsjf: {
      value: rate(featuresWsjf, totalFeatures),
      detail: `${featuresWsjf}/${totalFeatures} Features bewertet`,
    },
    featureQs: {
      value: rate(featuresApproved, totalFeatures),
      detail: `${featuresApproved}/${totalFeatures} Features freigegeben`,
    },
    piObjectives: {
      value: rate(teamsWithObjectives.length, totalTeams),
      detail:
        activePiIds.length === 0
          ? "kein aktives PI"
          : `${teamsWithObjectives.length}/${totalTeams} Teams mit Zielen`,
    },
    dependencies: {
      value: dependencyCount > 0 ? 1 : 0,
      detail: `${dependencyCount} verknüpft`,
    },
    stageGates: {
      value: rate(epicsBeyondFunnel, totalEpics),
      detail: `${epicsBeyondFunnel}/${totalEpics} Epics über L0`,
    },
    multiPartyApproval: {
      value: rate(epicsInApproval, totalEpics),
      detail: `${epicsInApproval}/${totalEpics} Epics in/über Freigabe`,
    },
  };

  const signals: AdoptionSignal[] = (Object.keys(candidates) as (keyof typeof candidates)[])
    .filter((key) => on[key])
    .map((key) => ({ key, label: PRACTICE_LABELS[key], ...candidates[key] }));

  return { hasTarget: true, signals };
}

/** A recommended action that closes part of the Soll/Ist gap. */
export interface NextStep {
  key: string;
  title: string;
  href: string;
}

/** Adoption below this counts as "barely used" and surfaces as a next step. */
const LOW_ADOPTION = 0.5;

const STRUCTURE_HREF: Record<string, string> = {
  valueStreams: "/structure",
  arts: "/structure?tab=arts",
  teams: "/structure?tab=arts",
};

const PRACTICE_HREF: Partial<Record<Practice, string>> = {
  wsjf: "/structure?tab=arts",
  featureQs: "/quality/features",
  piObjectives: "/pi-planning",
  dependencies: "/pi-planning",
  stageGates: "/portfolio/epics",
  multiPartyApproval: "/portfolio/epics",
};

/**
 * Turns the measured gap into prioritised next steps — the coaching layer.
 * Pure: derived from the already-computed structure gap + practice adoption, so
 * no extra queries. Structure shortfalls come first (concrete, unblocking),
 * then under-adopted practices.
 */
export function deriveNextSteps(gap: StructureGap, adoption: PracticeAdoption): NextStep[] {
  const steps: NextStep[] = [];

  for (const d of gap.dimensions) {
    if (d.soll != null && d.ist < d.soll) {
      steps.push({
        key: `struct-${d.key}`,
        title: `Noch ${d.soll - d.ist} ${d.label} anlegen`,
        href: STRUCTURE_HREF[d.key] ?? "/structure",
      });
    }
  }

  for (const s of adoption.signals) {
    if (s.value < LOW_ADOPTION) {
      steps.push({
        key: `prac-${s.key}`,
        title: `${s.label}: niedrige Adoption (${s.detail})`,
        href: PRACTICE_HREF[s.key] ?? "/transformation/ziel",
      });
    }
  }

  return steps;
}
