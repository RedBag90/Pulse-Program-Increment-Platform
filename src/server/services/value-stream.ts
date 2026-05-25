import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";
import { notDeleted } from "@/server/db/soft-delete";

export interface CreateValueStreamInput {
  name: string;
  description?: string | undefined;
}

export interface UpdateValueStreamInput {
  id: ValueStreamId;
  name?: string | undefined;
  description?: string | undefined;
  /** Finance party approver for this value stream's Epics; null clears it. */
  financeApproverId?: string | null | undefined;
  /** Responsible VMO for this value stream; null clears it. */
  vmoId?: string | null | undefined;
}

export async function createValueStream(
  ctx: RequestContext,
  input: CreateValueStreamInput,
): Promise<Result<{ id: ValueStreamId }>> {
  const mctx = toMutationContext(ctx);
  const { name, description } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const vs = await tx.valueStream.create({
        data: {
          tenantId: mctx.tenantId,
          name,
          ...(description !== undefined && { description }),
        },
      });

      return ok({
        result: { id: vs.id as ValueStreamId },
        audit: { action: "value_stream.created", resourceType: "value_stream", resourceId: vs.id },
      });
    },
    { onPrismaError: onUniqueConstraint(`Value stream "${name}" already exists`) },
  );
}

export async function updateValueStream(
  ctx: RequestContext,
  input: UpdateValueStreamInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, description, financeApproverId, vmoId } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const existing = await tx.valueStream.findFirst({
        where: { id, tenantId: mctx.tenantId, ...notDeleted },
      });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id });
      }

      // A value_stream owner may only edit their own stream (the row id is the
      // scope key) — enforced here with the real id, not the input alone.
      const authz = authorizeResource(ctx.principal, "value_stream.update", {
        tenantId: mctx.tenantId,
        valueStreamId: id,
      });
      if (isErr(authz)) return authz;

      const changes = buildChangelog(
        {
          name: existing.name,
          financeApproverId: existing.financeApproverId,
          vmoId: existing.vmoId,
        },
        {
          ...(name !== undefined && { name }),
          ...(financeApproverId !== undefined && { financeApproverId }),
          ...(vmoId !== undefined && { vmoId }),
        },
        ["name", "financeApproverId", "vmoId"],
      );

      await tx.valueStream.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(financeApproverId !== undefined && { financeApproverId }),
          ...(vmoId !== undefined && { vmoId }),
        },
      });

      return ok({
        result: undefined,
        audit: {
          action: "value_stream.updated",
          resourceType: "value_stream",
          resourceId: id,
          changes,
        },
      });
    },
    { onPrismaError: onUniqueConstraint(`Value stream "${name}" already exists`) },
  );
}

export async function softDeleteValueStream(
  ctx: RequestContext,
  input: { id: ValueStreamId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.valueStream.findFirst({
      where: { id, tenantId: mctx.tenantId, ...notDeleted },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "ValueStream", id });
    }

    await tx.valueStream.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ok({
      result: undefined,
      audit: { action: "value_stream.deleted", resourceType: "value_stream", resourceId: id },
    });
  });
}

export async function listValueStreams(db: PrismaClient, tenantId: TenantId) {
  return db.valueStream.findMany({
    where: { tenantId, ...notDeleted },
    include: { arts: { where: { ...notDeleted }, select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getValueStream(db: PrismaClient, tenantId: TenantId, id: ValueStreamId) {
  return db.valueStream.findFirst({
    where: { id, tenantId, ...notDeleted },
    include: {
      arts: {
        where: { ...notDeleted },
        select: { id: true, name: true, description: true, _count: { select: { teams: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
}
