import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { ArtId, TenantId, TimelineId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { applyPiStandard } from "@/server/services/pi-standard";
import { backfillSprints } from "@/server/services/sprint-backfill";

/**
 * Timelines — shared PI cadences that multiple ARTs can subscribe to.
 *
 * Each Timeline owns a list of `ProgramIncrement`s. ARTs join via
 * `Art.timelineId`; their teams get one Sprint per Timeline-PI during the
 * join. Leaving cleans those sprints up. The Feature → PI invariant moves
 * from "same ART" to "same Timeline" — see `setFeaturePi`.
 *
 * Backfill: `migrateAllArtsToOwnTimelines` creates one Timeline per existing
 * ART, preserving today's behaviour, so the rollout is functionally a no-op
 * for live tenants.
 */

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export interface CreateTimelineInput {
  name: string;
  cadenceWeeks?: number | undefined;
}

export async function createTimeline(
  ctx: RequestContext,
  input: CreateTimelineInput,
): Promise<Result<{ id: TimelineId }>> {
  const mctx = toMutationContext(ctx);
  const name = input.name.trim();
  if (name.length === 0) {
    return err({
      kind: "validation" as const,
      issues: [{ field: "name", message: "Pflichtfeld" }],
    });
  }
  const cadenceWeeks = input.cadenceWeeks ?? 10;
  if (cadenceWeeks <= 0 || cadenceWeeks > 52) {
    return err({
      kind: "conflict" as const,
      reason: "Kadenz in Wochen muss zwischen 1 und 52 liegen",
    });
  }
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.timeline.create({
      data: { tenantId: mctx.tenantId, name, cadenceWeeks },
      select: { id: true },
    });
    return ok({
      result: { id: row.id as TimelineId },
      audit: {
        action: "timeline.created",
        resourceType: "timeline",
        resourceId: row.id,
        changes: {
          name: { before: null, after: name },
          cadenceWeeks: { before: null, after: cadenceWeeks },
        },
      },
    });
  });
}

export interface UpdateTimelineInput {
  id: TimelineId;
  name?: string | undefined;
  cadenceWeeks?: number | undefined;
}

export async function updateTimeline(
  ctx: RequestContext,
  input: UpdateTimelineInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.timeline.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Timeline", id: input.id });
    }
    if (input.cadenceWeeks !== undefined && (input.cadenceWeeks <= 0 || input.cadenceWeeks > 52)) {
      return err({
        kind: "conflict" as const,
        reason: "Kadenz in Wochen muss zwischen 1 und 52 liegen",
      });
    }
    const name = input.name?.trim();
    const changes = buildChangelog(
      { name: existing.name, cadenceWeeks: existing.cadenceWeeks },
      {
        ...(name !== undefined && { name }),
        ...(input.cadenceWeeks !== undefined && { cadenceWeeks: input.cadenceWeeks }),
      },
      ["name", "cadenceWeeks"],
    );
    await tx.timeline.update({
      where: { id: input.id },
      data: {
        ...(name !== undefined && { name }),
        ...(input.cadenceWeeks !== undefined && { cadenceWeeks: input.cadenceWeeks }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "timeline.updated",
        resourceType: "timeline",
        resourceId: input.id,
        changes,
      },
    });
  });
}

/** Deletes a Timeline. Refuses while any ART is still subscribed. */
export async function deleteTimeline(
  ctx: RequestContext,
  input: { id: TimelineId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.timeline.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      include: { _count: { select: { arts: true, programIncrements: true } } },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Timeline", id: input.id });
    }
    if (existing._count.arts > 0) {
      return err({
        kind: "conflict" as const,
        reason: `Diese Timeline hat noch ${existing._count.arts} ART(s) zugeordnet — bitte zuerst lösen.`,
      });
    }
    // Cascade on the FK handles the PIs (and their sprints via PI's own cascade).
    await tx.timeline.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "timeline.deleted",
        resourceType: "timeline",
        resourceId: input.id,
        changes: {
          name: { before: existing.name, after: null },
          piCount: { before: existing._count.programIncrements, after: 0 },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Join / Leave (with sprint lifecycle)
// ---------------------------------------------------------------------------

export interface JoinArtToTimelineInput {
  artId: ArtId;
  timelineId: TimelineId;
}

/**
 * Subscribes an ART to a Timeline. If the ART was previously on a different
 * Timeline, leaves it first (cleaning up the old sprints). Then, for every
 * existing PI on the new Timeline, generates one Sprint per ART team so the
 * teams immediately have execution boxes inside those PIs.
 */
export async function joinArtToTimeline(
  ctx: RequestContext,
  input: JoinArtToTimelineInput,
): Promise<Result<{ sprintsCreated: number }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const [art, timeline] = await Promise.all([
      tx.art.findFirst({
        where: { id: input.artId, tenantId: mctx.tenantId, deletedAt: null },
        include: { teams: { select: { id: true } } },
      }),
      tx.timeline.findFirst({
        where: { id: input.timelineId, tenantId: mctx.tenantId },
        include: { programIncrements: { select: { id: true, startDate: true, endDate: true } } },
      }),
    ]);
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });
    if (!timeline) {
      return err({ kind: "not_found" as const, resourceType: "Timeline", id: input.timelineId });
    }
    if (art.timelineId === input.timelineId) {
      return ok({
        result: { sprintsCreated: 0 },
        audit: {
          action: "timeline.art.joined",
          resourceType: "timeline",
          resourceId: input.timelineId,
          changes: {
            artId: { before: null, after: input.artId },
            noop: { before: null, after: true },
          },
        },
      });
    }

    const previousTimelineId = art.timelineId;
    let detachedFromPrevious = { sprintsRemoved: 0, featuresUnassigned: 0, objectivesRemoved: 0 };
    if (previousTimelineId) {
      detachedFromPrevious = await detachArtFromTimeline(
        tx,
        mctx.tenantId,
        input.artId,
        previousTimelineId,
        art.teams,
      );
    }

    await tx.art.update({ where: { id: input.artId }, data: { timelineId: input.timelineId } });

    // Backfill: one sprint per (team, PI) for every existing Timeline PI.
    const { created: sprintsCreated } = await backfillSprints(
      tx,
      mctx.tenantId,
      timeline.programIncrements,
      art.teams,
    );

    return ok({
      result: { sprintsCreated },
      audit: {
        action: "timeline.art.joined",
        resourceType: "timeline",
        resourceId: input.timelineId,
        changes: {
          artId: { before: null, after: input.artId },
          previousTimelineId: { before: null, after: previousTimelineId ?? null },
          sprintsCreated: { before: null, after: sprintsCreated },
          ...(previousTimelineId
            ? {
                objectivesRemovedFromPrevious: {
                  before: null,
                  after: detachedFromPrevious.objectivesRemoved,
                },
              }
            : {}),
        },
      },
    });
  });
}

export async function leaveArtFromTimeline(
  ctx: RequestContext,
  input: { artId: ArtId },
): Promise<
  Result<{ sprintsRemoved: number; featuresUnassigned: number; objectivesRemoved: number }>
> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: input.artId, tenantId: mctx.tenantId, deletedAt: null },
      include: { teams: { select: { id: true } } },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });
    if (!art.timelineId) {
      return ok({
        result: { sprintsRemoved: 0, featuresUnassigned: 0, objectivesRemoved: 0 },
        audit: {
          action: "timeline.art.left",
          resourceType: "art",
          resourceId: input.artId,
          changes: { noop: { before: null, after: true } },
        },
      });
    }

    const { sprintsRemoved, featuresUnassigned, objectivesRemoved } = await detachArtFromTimeline(
      tx,
      mctx.tenantId,
      input.artId,
      art.timelineId,
      art.teams,
    );
    await tx.art.update({ where: { id: input.artId }, data: { timelineId: null } });

    return ok({
      result: { sprintsRemoved, featuresUnassigned, objectivesRemoved },
      audit: {
        action: "timeline.art.left",
        resourceType: "art",
        resourceId: input.artId,
        changes: {
          timelineId: { before: art.timelineId, after: null },
          sprintsRemoved: { before: null, after: sprintsRemoved },
          featuresUnassigned: { before: null, after: featuresUnassigned },
          objectivesRemoved: { before: null, after: objectivesRemoved },
        },
      },
    });
  });
}

/**
 * Cleans up an ART's footprint inside one Timeline:
 * - Deletes Sprints of the ART's teams in that Timeline's PIs.
 * - Stories in those sprints lose their `sprintId` (same step as in `deletePi`).
 * - Features of this ART that pointed at one of those PIs have their `piId`
 *   cleared (they fall back to the backlog).
 * - PiObjectives held by this ART's teams on those Timeline PIs are deleted —
 *   without the ART, the team has no owner on the shared Timeline; without
 *   the team, the objective has no author. Leaving them behind produced
 *   orphan rows that other ARTs would render on the same PI.
 *
 * Returns a count for each cleanup step so the caller can fold them into the
 * audit changeset. Doesn't touch sprints of other ARTs or other Timelines.
 *
 * Sibling: `deletePi` ([pi.ts](./pi.ts)) handles a different lifecycle event
 * — the PI row going away. The two functions look similar but encode
 * different policies (Impediments, PI-row deletion). See
 * `docs/adr/0005-cascade-unlink-stays-split.md` for why they stay separate.
 */
async function detachArtFromTimeline(
  tx: Prisma.TransactionClient,
  tenantId: string,
  artId: string,
  timelineId: string,
  teams: { id: string }[],
): Promise<{ sprintsRemoved: number; featuresUnassigned: number; objectivesRemoved: number }> {
  const teamIds = teams.map((t) => t.id);
  const pis = await tx.programIncrement.findMany({
    where: { tenantId, timelineId },
    select: { id: true },
  });
  const piIds = pis.map((p) => p.id);
  if (piIds.length === 0 || teamIds.length === 0) {
    return { sprintsRemoved: 0, featuresUnassigned: 0, objectivesRemoved: 0 };
  }
  // Stories in the doomed sprints lose their sprint link.
  const doomedSprints = await tx.sprint.findMany({
    where: { tenantId, piId: { in: piIds }, teamId: { in: teamIds } },
    select: { id: true },
  });
  const sprintIds = doomedSprints.map((s) => s.id);
  if (sprintIds.length > 0) {
    await tx.initiative.updateMany({
      where: { tenantId, sprintId: { in: sprintIds } },
      data: { sprintId: null },
    });
  }
  const sprintsRemoved = await tx.sprint.deleteMany({
    where: { tenantId, piId: { in: piIds }, teamId: { in: teamIds } },
  });

  // Features of this ART that were assigned to one of these Timeline PIs lose
  // their PI link — the timeline no longer covers them.
  const featuresUnassigned = await tx.initiative.updateMany({
    where: { tenantId, artId, piId: { in: piIds } },
    data: { piId: null },
  });

  // Objectives held by the leaving ART's teams on these Timeline PIs are
  // bound to (PI, Team) — once the team leaves the Timeline its objective
  // there has no carrier. Without this delete the row would resurface on
  // re-join and render under the next ART that happens to share a Timeline-PI.
  const objectivesRemoved = await tx.piObjective.deleteMany({
    where: { tenantId, piId: { in: piIds }, teamId: { in: teamIds } },
  });

  return {
    sprintsRemoved: sprintsRemoved.count,
    featuresUnassigned: featuresUnassigned.count,
    objectivesRemoved: objectivesRemoved.count,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TimelineSummary {
  id: string;
  name: string;
  cadenceWeeks: number;
  artCount: number;
  piCount: number;
}

export async function listTimelines(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<TimelineSummary[]> {
  const rows = await db.timeline.findMany({
    where: { tenantId },
    include: { _count: { select: { arts: true, programIncrements: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    cadenceWeeks: t.cadenceWeeks,
    artCount: t._count.arts,
    piCount: t._count.programIncrements,
  }));
}

export interface TimelineDetail {
  id: string;
  name: string;
  cadenceWeeks: number;
  pis: Array<{ id: string; name: string; status: string; startDate: Date; endDate: Date }>;
  arts: Array<{ id: string; name: string; valueStreamId: string; valueStreamName: string | null }>;
}

export async function getTimelineDetail(
  db: PrismaClient,
  tenantId: TenantId,
  id: TimelineId,
): Promise<TimelineDetail | null> {
  const row = await db.timeline.findFirst({
    where: { id, tenantId },
    include: {
      programIncrements: {
        select: { id: true, name: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      },
      arts: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          valueStreamId: true,
          valueStream: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cadenceWeeks: row.cadenceWeeks,
    pis: row.programIncrements,
    arts: row.arts.map((a) => ({
      id: a.id,
      name: a.name,
      valueStreamId: a.valueStreamId,
      valueStreamName: a.valueStream?.name ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Bootstrap: create a Timeline named after a PI standard and apply the
// standard's PI series in one go. Two separate audited transactions —
// mirrors `createArtWithStandard` in art-setup.ts.
// ---------------------------------------------------------------------------

export async function createTimelineFromStandard(
  ctx: RequestContext,
  input: { standardId: string; year?: number },
): Promise<Result<{ id: TimelineId }>> {
  const tenantId = ctx.principal.tenantId;
  const standard = await ctx.db.piStandard.findFirst({
    where: { id: input.standardId, tenantId },
    select: { name: true, cadenceWeeks: true },
  });
  if (!standard) {
    return err({ kind: "not_found" as const, resourceType: "PiStandard", id: input.standardId });
  }

  const created = await createTimeline(ctx, {
    name: standard.name,
    cadenceWeeks: standard.cadenceWeeks,
  });
  if (isErr(created)) return created;

  const year = input.year ?? new Date().getUTCFullYear();
  const applied = await applyPiStandard(ctx, {
    timelineId: created.value.id,
    standardId: input.standardId,
    year,
  });
  // If applying the standard fails, the Timeline still exists; the user can
  // retry from the per-Timeline "+ Standard" control without re-creating it.
  if (isErr(applied)) return applied;

  return ok({ id: created.value.id });
}

// ---------------------------------------------------------------------------
// One-shot migration: backfill timelines from existing ARTs + PIs
// ---------------------------------------------------------------------------

/**
 * For every ART without a Timeline, creates a Timeline named after the ART
 * (cadence = `Art.piCadenceWeeks`) and assigns it. For every PI without a
 * `timelineId` but with a legacy `artId`, sets `pi.timelineId = art.timelineId`.
 * Idempotent — safe to run repeatedly.
 *
 * Designed to run once during the rollout, either via an admin button or a
 * test script. After this returns, the system can operate purely on Timelines.
 */
export async function migrateAllArtsToOwnTimelines(
  db: PrismaClient,
  tenantId: TenantId,
  systemActorId: string,
): Promise<{ timelinesCreated: number; pisLinked: number }> {
  return db.$transaction(async (tx) => {
    const arts = await tx.art.findMany({
      where: { tenantId, deletedAt: null, timelineId: null },
      select: { id: true, name: true, piCadenceWeeks: true },
    });
    let timelinesCreated = 0;
    for (const art of arts) {
      const tl = await tx.timeline.create({
        data: { tenantId, name: art.name, cadenceWeeks: art.piCadenceWeeks },
        select: { id: true },
      });
      await tx.art.update({ where: { id: art.id }, data: { timelineId: tl.id } });
      timelinesCreated++;
    }

    // Stamp legacy PIs onto their (now-existing) ART timelines.
    const legacyPis = await tx.programIncrement.findMany({
      where: { tenantId, timelineId: null, artId: { not: null } },
      select: { id: true, artId: true },
    });
    let pisLinked = 0;
    for (const pi of legacyPis) {
      if (!pi.artId) continue;
      const art = await tx.art.findUnique({
        where: { id: pi.artId },
        select: { timelineId: true },
      });
      if (!art?.timelineId) continue;
      await tx.programIncrement.update({
        where: { id: pi.id },
        data: { timelineId: art.timelineId },
      });
      pisLinked++;
    }

    // Audit footprint (single row, deliberately coarse — this is a one-shot).
    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: systemActorId,
        action: "timeline.created",
        resourceType: "tenant",
        resourceId: tenantId,
        traceId: crypto.randomUUID(),
        changes: {
          timelinesCreated: { before: null, after: timelinesCreated },
          pisLinked: { before: null, after: pisLinked },
          migration: { before: null, after: "migrateAllArtsToOwnTimelines" },
        },
      },
    });

    return { timelinesCreated, pisLinked };
  });
}
