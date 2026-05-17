import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, PiId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { generateSprints, validateDateRange } from "@/domain/pi-planning";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";
import { paginate, type PageParams } from "@/server/db/paginate";

export interface CreatePiInput {
  artId: ArtId;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdatePiInput {
  id: PiId;
  name?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  status?: string | undefined;
}

export type PiStatus = "planned" | "active" | "completed";

export async function createPi(
  ctx: RequestContext,
  input: CreatePiInput,
): Promise<Result<{ id: PiId }>> {
  const mctx = toMutationContext(ctx);
  const { artId, name, startDate, endDate } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
      }

      const dateCheck = validateDateRange(startDate, endDate);
      if (isErr(dateCheck)) return dateCheck;

      const pi = await tx.programIncrement.create({
        data: { tenantId: mctx.tenantId, artId, name, startDate, endDate },
      });

      const teams = await tx.team.findMany({ where: { artId, tenantId: mctx.tenantId } });
      if (teams.length > 0) {
        const drafts = generateSprints(startDate, endDate, teams);
        await tx.sprint.createMany({
          data: drafts.map((s) => ({ tenantId: mctx.tenantId, piId: pi.id, ...s })),
        });
      }

      return ok({
        result: { id: pi.id as PiId },
        audit: { action: "pi.created", resourceType: "program_increment", resourceId: pi.id },
      });
    },
    { onPrismaError: onUniqueConstraint(`PI "${name}" already exists in this ART`) },
  );
}

export async function updatePi(ctx: RequestContext, input: UpdatePiInput): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, startDate, endDate, status } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    if (existing.status === "completed" && status !== "completed") {
      return err({ kind: "conflict" as const, reason: "Cannot reopen a completed PI" });
    }

    // Lifecycle transitions to active/completed go through startPi/completePi,
    // which enforce the one-active-PI rule and objective commitment checks.
    if (status !== undefined && status !== existing.status && status !== "planned") {
      return err({
        kind: "conflict" as const,
        reason: `Use the ${status === "active" ? "start" : "complete"} action to move a PI to "${status}"`,
      });
    }

    const changes = buildChangelog(
      { name: existing.name, status: existing.status },
      { ...(name !== undefined && { name }), ...(status !== undefined && { status }) },
      ["name", "status"],
    );

    await tx.programIncrement.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "pi.updated", resourceType: "program_increment", resourceId: id, changes },
    });
  });
}

/**
 * Starts a PI: enforces that no other PI in the ART is active and that every
 * team in the ART has at least one committed PI Objective (concept PULSE-29).
 */
export async function startPi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    if (existing.status !== "planned") {
      return err({
        kind: "conflict" as const,
        reason: `Only a planned PI can be started (current status: ${existing.status})`,
      });
    }

    const otherActive = await tx.programIncrement.findFirst({
      where: { tenantId: mctx.tenantId, artId: existing.artId, status: "active", id: { not: id } },
    });
    if (otherActive) {
      return err({
        kind: "conflict" as const,
        reason: `PI "${otherActive.name}" is already active in this ART; complete it first`,
      });
    }

    // Every team in the ART must have at least one committed objective.
    const teams = await tx.team.findMany({
      where: { tenantId: mctx.tenantId, artId: existing.artId },
    });
    if (teams.length > 0) {
      const committed = await tx.piObjective.findMany({
        where: { tenantId: mctx.tenantId, piId: id, committed: true },
        select: { teamId: true },
      });
      const teamsWithObjectives = new Set(committed.map((o) => o.teamId));
      const missing = teams.filter((t) => !teamsWithObjectives.has(t.id));
      if (missing.length > 0) {
        return err({
          kind: "conflict" as const,
          reason: `These teams have no committed PI objectives: ${missing.map((t) => t.name).join(", ")}`,
        });
      }
    }

    await tx.programIncrement.update({ where: { id }, data: { status: "active" } });

    return ok({
      result: undefined,
      audit: {
        action: "pi.started",
        resourceType: "program_increment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "active" } },
      },
    });
  });
}

/** Completes an active PI. */
export async function completePi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.programIncrement.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }

    if (existing.status !== "active") {
      return err({
        kind: "conflict" as const,
        reason: `Only an active PI can be completed (current status: ${existing.status})`,
      });
    }

    await tx.programIncrement.update({ where: { id }, data: { status: "completed" } });

    return ok({
      result: undefined,
      audit: {
        action: "pi.completed",
        resourceType: "program_increment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "completed" } },
      },
    });
  });
}

/**
 * Delete a planned PI and cascade: its sprints and objectives are removed, assigned
 * features return to the backlog (piId → null), stories leave their sprints
 * (sprintId → null), and impediments are detached but kept in the ART log.
 */
export async function deletePi(ctx: RequestContext, input: { id: PiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const pi = await tx.programIncrement.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!pi) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
    }
    if (pi.status !== "planned") {
      return err({ kind: "conflict" as const, reason: "Only a planned PI can be deleted" });
    }

    const sprints = await tx.sprint.findMany({
      where: { tenantId: mctx.tenantId, piId: id },
      select: { id: true },
    });
    const sprintIds = sprints.map((s) => s.id);

    // Features assigned to this PI fall back to the backlog.
    await tx.initiative.updateMany({
      where: { tenantId: mctx.tenantId, piId: id },
      data: { piId: null },
    });

    // Stories in this PI's sprints lose their sprint assignment.
    if (sprintIds.length > 0) {
      await tx.initiative.updateMany({
        where: { tenantId: mctx.tenantId, sprintId: { in: sprintIds } },
        data: { sprintId: null },
      });
    }

    // Impediments are kept (ART-scoped) but detached from the PI/sprints.
    await tx.impediment.updateMany({
      where: { tenantId: mctx.tenantId, OR: [{ piId: id }, { sprintId: { in: sprintIds } }] },
      data: { piId: null, sprintId: null },
    });

    await tx.piObjective.deleteMany({ where: { tenantId: mctx.tenantId, piId: id } });
    await tx.sprint.deleteMany({ where: { tenantId: mctx.tenantId, piId: id } });
    await tx.programIncrement.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "pi.deleted", resourceType: "program_increment", resourceId: id },
    });
  });
}

export async function listPis(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const where = { tenantId, artId };
  const include = { _count: { select: { sprints: true, initiatives: true } } };
  const orderBy = { startDate: "desc" as const };

  return paginate(
    ({ take, skip }) => db.programIncrement.findMany({ where, include, orderBy, take, skip }),
    () => db.programIncrement.count({ where }),
    pageParams,
  );
}

/**
 * Program Increments across several ARTs at once — feeds the per-feature PI
 * picker on the Epic Breakdown tab, where child Features may span ARTs.
 */
export async function listProgramIncrementsForArts(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: string[],
) {
  if (artIds.length === 0) return [];
  return db.programIncrement.findMany({
    where: { tenantId, artId: { in: artIds } },
    select: { id: true, name: true, artId: true },
    orderBy: { startDate: "desc" },
  });
}

export async function getPi(db: PrismaClient, tenantId: TenantId, id: PiId) {
  return db.programIncrement.findFirst({
    where: { id, tenantId },
    include: {
      art: { select: { id: true, name: true } },
      sprints: {
        orderBy: [{ teamId: "asc" }, { indexInPi: "asc" }],
        select: {
          id: true,
          indexInPi: true,
          startDate: true,
          endDate: true,
          teamId: true,
          team: { select: { id: true, name: true } },
          initiatives: {
            where: { deletedAt: null, level: 2 },
            select: { id: true, title: true, status: true, storyPoints: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      initiatives: {
        where: { deletedAt: null, level: 1 },
        select: { id: true, title: true, status: true, wsjfComputed: true },
        orderBy: { wsjfComputed: "desc" },
      },
    },
  });
}
