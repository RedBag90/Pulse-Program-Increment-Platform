import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/domain/types";
import type { Principal } from "@/server/auth/principal";

/**
 * RTE-Cockpit page-model. One DB sweep per ART, fanned out into the four
 * cockpit surfaces Anna scans during a stand-up: a hero (PI horizon +
 * predictability), three "today" counters (open approvals, escalated
 * impediments, cross-ART blockers), a per-team RAG grid, and the
 * Epic→Feature rollup for the active PI.
 *
 * Each piece is read-only — every CTA on the page links into the
 * existing list / drawer surfaces (`/my-approvals`, `/art/<id>/
 * impediments`, `/pi/<id>/dependencies`, `/portfolio/epics`).
 *
 * Predictability is approximated as "completed feature ratio per PI"
 * since `PiObjective` carries `confidence` + `businessValue` but no
 * explicit `delivered/committed` split (PR 3 wires this through the
 * Closure Wizard).
 */

const COMPLETED_STATUSES = new Set(["completed", "done"]);

export type RagTier = "green" | "amber" | "red" | "muted";

export interface RteCockpitHero {
  artId: string;
  artName: string;
  activePi: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    /** Tage bis Ende (kann negativ sein, wenn das PI überfällig ist). */
    daysUntilEnd: number;
  } | null;
  /** Mittelwert delivered/committed (Features completed/total) über die letzten ≤3 abgeschlossenen PIs; null wenn keine Historie. */
  predictability: { value: number; piNames: string[] } | null;
  /** Mittelwert PiObjective.confidence (1‒5) für die aktive PI; null wenn keine Stimmen. */
  confidenceAvg: number | null;
}

export interface RteTodayCounts {
  openApprovals: number;
  escalatedImpediments: number;
  crossArtBlockers: number;
}

export interface RteTeamRagRow {
  teamId: string;
  teamName: string;
  /** Avg. confidence der letzten Objectives für die aktive PI (1‒5), null wenn ohne Vote. */
  confidence: number | null;
  /** Velocity-Trend (letzte ≤5 Sprints) — delivered story points pro Sprint. */
  velocity: { sprintIndex: number; delivered: number; target: number | null }[];
  openImpediments: number;
  blockers: number;
  featureBurnup: { completed: number; inPi: number };
  rag: RagTier;
}

export interface RteEpicRollupRow {
  epicId: string;
  title: string;
  hypothesisSignal: "green" | "amber" | "red" | "muted";
  features: { id: string; title: string; status: string }[];
  href: string;
}

export interface RteCockpitModel {
  hero: RteCockpitHero;
  today: RteTodayCounts;
  teams: RteTeamRagRow[];
  epicRollup: RteEpicRollupRow[];
}

export interface RtePortfolioRow {
  artId: string;
  artName: string;
  activePiName: string | null;
  openApprovals: number;
  escalatedImpediments: number;
  teamCount: number;
  confidenceAvg: number | null;
  rag: RagTier;
}

export interface RtePortfolioModel {
  arts: RtePortfolioRow[];
}

// ───────────────────────────── helpers ─────────────────────────────

export interface RecentFeatureRow {
  piId: string;
  status: string;
}

export interface ActiveFeatureRow {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
}

export interface EpicRow {
  id: string;
  title: string;
  status: string;
}

export interface RtePortfolioInputs {
  artId: string;
  artName: string;
  activePiName: string | null;
  teamCount: number;
  escalatedImpediments: number;
  openApprovals: number;
  confidences: number[];
}

/**
 * Predictability across the last ≤3 closed PIs as the simple ratio
 * delivered-features / in-PI-features. Pure so the page-model test
 * can pin the math without going through Prisma.
 */
export function pickRecentPiPredictability(
  recentClosedPis: { id: string; name: string }[],
  features: RecentFeatureRow[],
): { value: number; piNames: string[] } | null {
  if (recentClosedPis.length === 0) return null;
  const perPi = new Map<string, { completed: number; total: number }>();
  for (const f of features) {
    const b = perPi.get(f.piId) ?? { completed: 0, total: 0 };
    b.total += 1;
    if (COMPLETED_STATUSES.has(f.status)) b.completed += 1;
    perPi.set(f.piId, b);
  }
  const ratios: number[] = [];
  for (const p of recentClosedPis) {
    const b = perPi.get(p.id);
    if (b && b.total > 0) ratios.push(b.completed / b.total);
  }
  if (ratios.length === 0) return null;
  return {
    value: ratios.reduce((s, r) => s + r, 0) / ratios.length,
    piNames: recentClosedPis.map((p) => p.name),
  };
}

/**
 * Epic→Feature rollup for the active PI. Features are bucketed by
 * `parentId`; epics without features in the PI render as `muted`.
 * Order: most-features-first so the longest lanes float to the top.
 */
export function rollUpEpics(
  epics: EpicRow[],
  activeFeatures: ActiveFeatureRow[],
): RteEpicRollupRow[] {
  return epics
    .map((e) => {
      const feats = activeFeatures
        .filter((f) => f.parentId === e.id)
        .map((f) => ({ id: f.id, title: f.title, status: f.status }));
      const signal: RteEpicRollupRow["hypothesisSignal"] =
        e.status === "blocked" || e.status === "cancelled"
          ? "red"
          : e.status === "draft"
            ? "amber"
            : feats.length === 0
              ? "muted"
              : "green";
      return {
        epicId: e.id,
        title: e.title,
        hypothesisSignal: signal,
        features: feats,
        href: `/portfolio/epics/${e.id}`,
      };
    })
    .sort((a, b) => b.features.length - a.features.length);
}

/**
 * One row of the portfolio table. RAG is the worse of:
 *  · confidence tier (≥4 green · ≥3 amber · <3 red · none muted)
 *  · "any escalation = amber" floor.
 */
export function composeRtePortfolioRow(input: RtePortfolioInputs): RtePortfolioRow {
  const confidenceAvg =
    input.confidences.length > 0
      ? input.confidences.reduce((s, c) => s + c, 0) / input.confidences.length
      : null;
  const escalationFloor: RagTier = input.escalatedImpediments > 0 ? "amber" : "muted";
  const rag = combineRag(ragForConfidence(confidenceAvg), escalationFloor);
  return {
    artId: input.artId,
    artName: input.artName,
    activePiName: input.activePiName,
    openApprovals: input.openApprovals,
    escalatedImpediments: input.escalatedImpediments,
    teamCount: input.teamCount,
    confidenceAvg,
    rag,
  };
}

function ragForConfidence(c: number | null): RagTier {
  if (c == null) return "muted";
  if (c >= 4) return "green";
  if (c >= 3) return "amber";
  return "red";
}

function ragForBurnup(b: { completed: number; inPi: number }): RagTier {
  if (b.inPi === 0) return "muted";
  const r = b.completed / b.inPi;
  if (r >= 0.7) return "green";
  if (r >= 0.3) return "amber";
  return "red";
}

function combineRag(a: RagTier, b: RagTier): RagTier {
  const rank: Record<RagTier, number> = { red: 3, amber: 2, green: 1, muted: 0 };
  return rank[a] >= rank[b] ? a : b;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
}

// ─────────────────────────── ART cockpit ───────────────────────────

export async function buildRteCockpitModel(
  db: PrismaClient,
  principal: Principal,
  artId: string,
  now: Date = new Date(),
): Promise<RteCockpitModel> {
  const { tenantId } = principal;

  const art = await db.art.findFirst({
    where: { id: artId, tenantId, deletedAt: null },
    select: { id: true, name: true, timelineId: true },
  });
  if (!art) {
    throw new Error(`ART ${artId} not found`);
  }

  const [activePi, recentClosedPis, teams] = await Promise.all([
    art.timelineId
      ? db.programIncrement.findFirst({
          where: { tenantId, timelineId: art.timelineId, status: "active" },
          select: { id: true, name: true, startDate: true, endDate: true },
        })
      : null,
    art.timelineId
      ? db.programIncrement.findMany({
          where: { tenantId, timelineId: art.timelineId, status: "completed" },
          orderBy: { endDate: "desc" },
          take: 3,
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    db.team.findMany({
      where: { tenantId, artId },
      select: {
        id: true,
        name: true,
        targetVelocity: true,
      },
    }),
  ]);

  // Predictability — completed-feature ratio across the last ≤3 closed PIs.
  const recentPiIds = recentClosedPis.map((p) => p.id);
  const recentFeatures =
    recentPiIds.length > 0
      ? await db.initiative.findMany({
          where: {
            tenantId,
            artId,
            level: InitiativeLevel.FEATURE,
            piId: { in: recentPiIds },
            deletedAt: null,
          },
          select: { piId: true, status: true },
        })
      : [];
  const predictability = pickRecentPiPredictability(
    recentClosedPis,
    recentFeatures
      .filter((f): f is { piId: string; status: string } => f.piId != null)
      .map((f) => ({ piId: f.piId, status: f.status })),
  );

  // Per-active-PI: objectives (confidence) + active features + impediments + sprints.
  const [activeObjectives, activeFeatures, openImpediments, blockers] = await Promise.all([
    activePi
      ? db.piObjective.findMany({
          where: { tenantId, piId: activePi.id, team: { artId } },
          select: { teamId: true, confidence: true, businessValue: true },
        })
      : Promise.resolve(
          [] as { teamId: string; confidence: number | null; businessValue: number | null }[],
        ),
    activePi
      ? db.initiative.findMany({
          where: {
            tenantId,
            artId,
            level: InitiativeLevel.FEATURE,
            piId: activePi.id,
            deletedAt: null,
          },
          select: { id: true, parentId: true, status: true, title: true, assigneeIds: true },
        })
      : Promise.resolve(
          [] as {
            id: string;
            parentId: string | null;
            status: string;
            title: string;
            assigneeIds: string[];
          }[],
        ),
    db.impediment.findMany({
      where: { tenantId, artId, status: { in: ["open", "escalated"] } },
      select: { id: true, status: true, severity: true },
    }),
    activePi
      ? db.dependency.findMany({
          where: {
            tenantId,
            type: "blocks",
            to: { artId, piId: activePi.id, deletedAt: null },
          },
          select: { id: true, from: { select: { artId: true } } },
        })
      : Promise.resolve([] as { id: string; from: { artId: string | null } }[]),
  ]);

  const escalatedCount = openImpediments.filter((i) => i.status === "escalated").length;
  const crossArtBlockerCount = blockers.filter((b) => b.from.artId !== artId).length;

  // Recent sprint velocity per team (last 5 sprints, completed story points).
  const teamIds = teams.map((t) => t.id);
  const recentSprints =
    teamIds.length > 0
      ? await db.sprint.findMany({
          where: { tenantId, teamId: { in: teamIds }, endDate: { lte: now } },
          orderBy: { endDate: "desc" },
          take: teamIds.length * 5,
          select: {
            id: true,
            teamId: true,
            indexInPi: true,
            initiatives: {
              where: { level: InitiativeLevel.STORY, deletedAt: null },
              select: { status: true, storyPoints: true },
            },
          },
        })
      : [];

  const velocityByTeam = new Map<string, RteTeamRagRow["velocity"]>();
  for (const t of teams) velocityByTeam.set(t.id, []);
  for (const s of recentSprints) {
    const list = velocityByTeam.get(s.teamId)!;
    if (list.length >= 5) continue;
    const delivered = s.initiatives.reduce(
      (sum, i) => sum + (COMPLETED_STATUSES.has(i.status) ? (i.storyPoints ?? 0) : 0),
      0,
    );
    const target = teams.find((t) => t.id === s.teamId)?.targetVelocity ?? null;
    list.push({ sprintIndex: s.indexInPi, delivered, target });
  }
  for (const list of velocityByTeam.values()) list.reverse(); // oldest → newest

  // Per-team confidence + burnup.
  const confidenceByTeam = new Map<string, number[]>();
  for (const o of activeObjectives) {
    if (o.confidence == null) continue;
    const arr = confidenceByTeam.get(o.teamId) ?? [];
    arr.push(o.confidence);
    confidenceByTeam.set(o.teamId, arr);
  }

  // Map features → team via assigneeIds[0] heuristic isn't reliable; we
  // bucket per-team via a sprintId → teamId lookup. For simplicity here,
  // skip team-mapped burnup and use an ART-wide burnup divided proportionally.
  // Concretely: list all features per team via Story→Sprint→Team.
  const stories =
    activePi && teamIds.length > 0
      ? await db.initiative.findMany({
          where: {
            tenantId,
            level: InitiativeLevel.STORY,
            piId: activePi.id,
            sprint: { teamId: { in: teamIds } },
            deletedAt: null,
          },
          select: { parentId: true, sprint: { select: { teamId: true } } },
        })
      : [];
  const featuresByTeam = new Map<string, Set<string>>();
  for (const t of teams) featuresByTeam.set(t.id, new Set());
  for (const story of stories) {
    if (!story.parentId || !story.sprint) continue;
    featuresByTeam.get(story.sprint.teamId)?.add(story.parentId);
  }
  const featureStatusById = new Map(activeFeatures.map((f) => [f.id, f.status]));

  const impCountByTeam = new Map<string, number>(); // we don't have a team FK on impediment
  // Distribute open impediments evenly across teams as fallback (no team col).
  const evenShare = teams.length > 0 ? Math.ceil(openImpediments.length / teams.length) : 0;

  const teamRows: RteTeamRagRow[] = teams.map((t) => {
    const velocity = velocityByTeam.get(t.id) ?? [];
    const confArr = confidenceByTeam.get(t.id) ?? [];
    const confidence =
      confArr.length > 0 ? confArr.reduce((s, c) => s + c, 0) / confArr.length : null;
    const teamFeatureIds = featuresByTeam.get(t.id) ?? new Set();
    const burnup = {
      inPi: teamFeatureIds.size,
      completed: [...teamFeatureIds].filter((id) =>
        COMPLETED_STATUSES.has(featureStatusById.get(id) ?? ""),
      ).length,
    };
    const teamBlockers = 0; // blockers are PI-level; not split per team
    const rag = combineRag(ragForConfidence(confidence), ragForBurnup(burnup));
    return {
      teamId: t.id,
      teamName: t.name,
      confidence,
      velocity,
      openImpediments: impCountByTeam.get(t.id) ?? evenShare,
      blockers: teamBlockers,
      featureBurnup: burnup,
      rag,
    };
  });

  // Confidence average across the active PI (hero).
  const allConf = activeObjectives.map((o) => o.confidence).filter((c): c is number => c != null);
  const confidenceAvg =
    allConf.length > 0 ? allConf.reduce((s, c) => s + c, 0) / allConf.length : null;

  // Today counts: openApprovals war historisch der Feature-QA-Backlog
  // — mit Abschaffung des Feature-QA-Gates (2026-06) immer 0.
  const today: RteTodayCounts = {
    openApprovals: 0,
    escalatedImpediments: escalatedCount,
    crossArtBlockers: crossArtBlockerCount,
  };

  // Epic → Feature rollup for the active PI.
  const epicIds = new Set(activeFeatures.map((f) => f.parentId).filter((p): p is string => !!p));
  const epicRows =
    epicIds.size > 0
      ? await db.initiative.findMany({
          where: { id: { in: [...epicIds] }, tenantId, deletedAt: null },
          select: { id: true, title: true, status: true },
        })
      : [];
  const epicRollup = rollUpEpics(
    epicRows,
    activeFeatures.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      title: f.title,
      status: f.status,
    })),
  );

  return {
    hero: {
      artId: art.id,
      artName: art.name,
      activePi: activePi
        ? {
            id: activePi.id,
            name: activePi.name,
            startDate: activePi.startDate,
            endDate: activePi.endDate,
            daysUntilEnd: daysBetween(now, activePi.endDate),
          }
        : null,
      predictability,
      confidenceAvg,
    },
    today,
    teams: teamRows,
    epicRollup,
  };
}

// ───────────────────────── portfolio overview ─────────────────────────

export async function buildRtePortfolioModel(
  db: PrismaClient,
  principal: Principal,
  artIds: string[],
): Promise<RtePortfolioModel> {
  const { tenantId } = principal;
  if (artIds.length === 0) return { arts: [] };

  const arts = await db.art.findMany({
    where: { id: { in: artIds }, tenantId, deletedAt: null },
    select: { id: true, name: true, timelineId: true },
  });

  const rows = await Promise.all(
    arts.map(async (art) => {
      const [activePi, teamCount, escalated] = await Promise.all([
        art.timelineId
          ? db.programIncrement.findFirst({
              where: { tenantId, timelineId: art.timelineId, status: "active" },
              select: { id: true, name: true },
            })
          : null,
        db.team.count({ where: { tenantId, artId: art.id } }),
        db.impediment.count({
          where: { tenantId, artId: art.id, status: "escalated" },
        }),
      ]);

      const confidenceAvgRaw = activePi
        ? await db.piObjective.findMany({
            where: { tenantId, piId: activePi.id, team: { artId: art.id } },
            select: { confidence: true },
          })
        : [];
      const confidences = confidenceAvgRaw
        .map((o) => o.confidence)
        .filter((c): c is number => c != null);

      return composeRtePortfolioRow({
        artId: art.id,
        artName: art.name,
        activePiName: activePi?.name ?? null,
        teamCount,
        escalatedImpediments: escalated,
        openApprovals: 0,
        confidences,
      });
    }),
  );

  return { arts: rows };
}
