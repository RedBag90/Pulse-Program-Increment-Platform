import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, ValueStreamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

export interface CreateArtInput {
  valueStreamId: ValueStreamId;
  name: string;
  piCadenceWeeks?: number | undefined;
}

export interface UpdateArtInput {
  id: ArtId;
  name?: string | undefined;
  description?: string | undefined;
  piCadenceWeeks?: number | undefined;
}

export async function createArt(
  ctx: RequestContext,
  input: CreateArtInput,
): Promise<Result<{ id: ArtId }>> {
  const mctx = toMutationContext(ctx);
  const { valueStreamId, name, piCadenceWeeks } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const vs = await tx.valueStream.findFirst({
        where: { id: valueStreamId, tenantId: mctx.tenantId },
      });
      if (!vs) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
      }

      const art = await tx.art.create({
        data: {
          tenantId: mctx.tenantId,
          valueStreamId,
          name,
          ...(piCadenceWeeks !== undefined && { piCadenceWeeks }),
        },
      });

      return ok({
        result: { id: art.id as ArtId },
        audit: { action: "art.created", resourceType: "art", resourceId: art.id },
      });
    },
    { onPrismaError: onUniqueConstraint(`ART "${name}" already exists`) },
  );
}

export async function updateArt(ctx: RequestContext, input: UpdateArtInput): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, description, piCadenceWeeks } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const existing = await tx.art.findFirst({ where: { id, tenantId: mctx.tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Art", id });
      }

      const changes = buildChangelog(
        {
          name: existing.name,
          description: existing.description,
          piCadenceWeeks: existing.piCadenceWeeks,
        },
        {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(piCadenceWeeks !== undefined && { piCadenceWeeks }),
        },
        ["name", "description", "piCadenceWeeks"],
      );

      await tx.art.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(piCadenceWeeks !== undefined && { piCadenceWeeks }),
        },
      });

      return ok({
        result: undefined,
        audit: { action: "art.updated", resourceType: "art", resourceId: id, changes },
      });
    },
    { onPrismaError: onUniqueConstraint(`ART "${name}" already exists`) },
  );
}

export async function softDeleteArt(
  ctx: RequestContext,
  input: { id: ArtId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.art.findFirst({
      where: { id, tenantId: mctx.tenantId },
      include: { _count: { select: { pis: true, teams: true } } },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Art", id });

    if (existing._count.pis > 0) {
      return err({
        kind: "conflict" as const,
        reason: "ART has Program Increments and cannot be deleted",
      });
    }

    if (existing._count.teams > 0) {
      return err({ kind: "conflict" as const, reason: "ART has teams — delete all teams first" });
    }

    await tx.art.update({
      where: { id },
      data: { name: `__deleted__${Date.now()}__${existing.name}` },
    });

    return ok({
      result: undefined,
      audit: { action: "art.deleted", resourceType: "art", resourceId: id },
    });
  });
}

export async function listArts(db: PrismaClient, tenantId: TenantId) {
  return db.art.findMany({
    where: { tenantId, name: { not: { startsWith: "__deleted__" } } },
    include: {
      valueStream: { select: { id: true, name: true } },
      _count: { select: { pis: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getArt(db: PrismaClient, tenantId: TenantId, id: ArtId) {
  return db.art.findFirst({
    where: { id, tenantId, name: { not: { startsWith: "__deleted__" } } },
    include: {
      valueStream: { select: { id: true, name: true } },
      pis: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
      teams: {
        select: { id: true, name: true, headcount: true, targetVelocity: true },
        orderBy: { name: "asc" },
      },
    },
  });
}
