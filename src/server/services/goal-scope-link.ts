import { ok, err, type Result } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

/**
 * VS/ART-Verantwortung eines Ziels (Epic 6a, n:m). Rein organisatorisch —
 * additiv, ohne Auth-Eingriff (Gate `target.manage` in der Action). Ein Ziel
 * kann mehreren Value Streams UND/ODER ARTs zugeordnet sein.
 */
export async function linkGoalValueStream(
  ctx: RequestContext,
  input: { objectiveId: string; valueStreamId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const node = await tx.objective.findFirst({
        where: { id: input.objectiveId, tenantId: mctx.tenantId },
      });
      if (!node) {
        return err({
          kind: "not_found" as const,
          resourceType: "Objective",
          id: input.objectiveId,
        });
      }
      const vs = await tx.valueStream.findFirst({
        where: { id: input.valueStreamId, tenantId: mctx.tenantId, deletedAt: null },
      });
      if (!vs) {
        return err({
          kind: "not_found" as const,
          resourceType: "ValueStream",
          id: input.valueStreamId,
        });
      }
      const row = await tx.goalValueStreamLink.create({
        data: {
          tenantId: mctx.tenantId,
          objectiveId: input.objectiveId,
          valueStreamId: input.valueStreamId,
          createdBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: row.id },
        audit: {
          action: "goal.value_stream.linked",
          resourceType: "goal_value_stream_link",
          resourceId: row.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint("Dieser Value Stream ist bereits zugeordnet.") },
  );
}

export async function unlinkGoalValueStream(
  ctx: RequestContext,
  input: { objectiveId: string; valueStreamId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.goalValueStreamLink.deleteMany({
      where: {
        tenantId: mctx.tenantId,
        objectiveId: input.objectiveId,
        valueStreamId: input.valueStreamId,
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "goal.value_stream.unlinked",
        resourceType: "goal_value_stream_link",
        resourceId: input.valueStreamId,
      },
    });
  });
}

export async function linkGoalArt(
  ctx: RequestContext,
  input: { objectiveId: string; artId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const node = await tx.objective.findFirst({
        where: { id: input.objectiveId, tenantId: mctx.tenantId },
      });
      if (!node) {
        return err({
          kind: "not_found" as const,
          resourceType: "Objective",
          id: input.objectiveId,
        });
      }
      const art = await tx.art.findFirst({
        where: { id: input.artId, tenantId: mctx.tenantId, deletedAt: null },
      });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });
      }
      const row = await tx.goalArtLink.create({
        data: {
          tenantId: mctx.tenantId,
          objectiveId: input.objectiveId,
          artId: input.artId,
          createdBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: row.id },
        audit: {
          action: "goal.art.linked",
          resourceType: "goal_art_link",
          resourceId: row.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint("Diese ART ist bereits zugeordnet.") },
  );
}

export async function unlinkGoalArt(
  ctx: RequestContext,
  input: { objectiveId: string; artId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.goalArtLink.deleteMany({
      where: { tenantId: mctx.tenantId, objectiveId: input.objectiveId, artId: input.artId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "goal.art.unlinked",
        resourceType: "goal_art_link",
        resourceId: input.artId,
      },
    });
  });
}
