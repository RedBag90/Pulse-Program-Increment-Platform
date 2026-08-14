import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { ArtId, TenantId, TimelineId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import { recordedUpdate } from "@/modules/core/kernel/server/recorded-update";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { applyPiStandard } from "@/modules/drumbeat/server/services/pi-standard";

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
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.timeline.create({
      data: { tenantId: mctx.tenantId, name },
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
        },
      },
    });
  });
}

export interface UpdateTimelineInput {
  id: TimelineId;
  name?: string | undefined;
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
    const name = input.name?.trim();
    const { changes, data } = recordedUpdate({
      existing,
      updates: { name },
      fields: ["name"] as const,
    });
    await tx.timeline.update({ where: { id: input.id }, data });
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
 * Timeline, leaves it first (detaching its Features from the old Timeline PIs).
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
    let detachedFromPrevious = { sprintsRemoved: 0, featuresUnassigned: 0 };
    if (previousTimelineId) {
      detachedFromPrevious = await detachArtFromTimeline(
        tx,
        mctx.tenantId,
        input.artId,
        previousTimelineId,
      );
    }

    await tx.art.update({ where: { id: input.artId }, data: { timelineId: input.timelineId } });

    return ok({
      result: { sprintsCreated: 0 },
      audit: {
        action: "timeline.art.joined",
        resourceType: "timeline",
        resourceId: input.timelineId,
        changes: {
          artId: { before: null, after: input.artId },
          previousTimelineId: { before: null, after: previousTimelineId ?? null },
          ...(previousTimelineId
            ? {
                featuresUnassignedFromPrevious: {
                  before: null,
                  after: detachedFromPrevious.featuresUnassigned,
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
): Promise<Result<{ sprintsRemoved: number; featuresUnassigned: number }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: input.artId, tenantId: mctx.tenantId, deletedAt: null },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });
    if (!art.timelineId) {
      return ok({
        result: { sprintsRemoved: 0, featuresUnassigned: 0 },
        audit: {
          action: "timeline.art.left",
          resourceType: "art",
          resourceId: input.artId,
          changes: { noop: { before: null, after: true } },
        },
      });
    }

    const { sprintsRemoved, featuresUnassigned } = await detachArtFromTimeline(
      tx,
      mctx.tenantId,
      input.artId,
      art.timelineId,
    );
    await tx.art.update({ where: { id: input.artId }, data: { timelineId: null } });

    return ok({
      result: { sprintsRemoved, featuresUnassigned },
      audit: {
        action: "timeline.art.left",
        resourceType: "art",
        resourceId: input.artId,
        changes: {
          timelineId: { before: art.timelineId, after: null },
          sprintsRemoved: { before: null, after: sprintsRemoved },
          featuresUnassigned: { before: null, after: featuresUnassigned },
        },
      },
    });
  });
}

/**
 * Cleans up an ART's footprint inside one Timeline: Features of this ART that
 * pointed at one of that Timeline's PIs have their `piId` cleared (they fall
 * back to the backlog). Returns the count so the caller can fold it into the
 * audit changeset. `sprintsRemoved` is retained as a always-0 field for the
 * audit shape (no Sprint/Team level any more).
 */
async function detachArtFromTimeline(
  tx: Prisma.TransactionClient,
  tenantId: string,
  artId: string,
  timelineId: string,
): Promise<{ sprintsRemoved: number; featuresUnassigned: number }> {
  const pis = await tx.programIncrement.findMany({
    where: { tenantId, timelineId },
    select: { id: true },
  });
  const piIds = pis.map((p) => p.id);
  if (piIds.length === 0) {
    return { sprintsRemoved: 0, featuresUnassigned: 0 };
  }

  // Features of this ART that were assigned to one of these Timeline PIs lose
  // their PI link — the timeline no longer covers them.
  const featuresUnassigned = await tx.initiative.updateMany({
    where: { tenantId, artId, piId: { in: piIds } },
    data: { piId: null },
  });

  return { sprintsRemoved: 0, featuresUnassigned: featuresUnassigned.count };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TimelineSummary {
  id: string;
  name: string;
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
    artCount: t._count.arts,
    piCount: t._count.programIncrements,
  }));
}

export interface TimelineDetail {
  id: string;
  name: string;
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
    select: { name: true },
  });
  if (!standard) {
    return err({ kind: "not_found" as const, resourceType: "PiStandard", id: input.standardId });
  }

  const created = await createTimeline(ctx, {
    name: standard.name,
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
      select: { id: true, name: true },
    });
    let timelinesCreated = 0;
    for (const art of arts) {
      const tl = await tx.timeline.create({
        data: { tenantId, name: art.name },
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
