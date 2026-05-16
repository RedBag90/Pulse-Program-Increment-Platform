import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, ValueStreamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreateArtInput {
  tenantId: TenantId;
  actorId: UserId;
  valueStreamId: ValueStreamId;
  name: string;
  piCadenceWeeks?: number | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateArtInput {
  tenantId: TenantId;
  actorId: UserId;
  id: ArtId;
  name?: string | undefined;
  piCadenceWeeks?: number | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createArt(
  db: PrismaClient,
  input: CreateArtInput,
): Promise<Result<{ id: ArtId }>> {
  const { tenantId, actorId, valueStreamId, name, piCadenceWeeks, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const vs = await tx.valueStream.findFirst({ where: { id: valueStreamId, tenantId } });
      if (!vs) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
      }

      const art = await tx.art.create({
        data: {
          tenantId,
          valueStreamId,
          name,
          ...(piCadenceWeeks !== undefined && { piCadenceWeeks }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "art.created",
        resourceType: "art",
        resourceId: art.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: art.id as ArtId });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `ART "${name}" already exists` });
      }
      throw e;
    });
}

export async function updateArt(db: PrismaClient, input: UpdateArtInput): Promise<Result<void>> {
  const { tenantId, actorId, id, name, piCadenceWeeks, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.art.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Art", id });
      }

      await tx.art.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(piCadenceWeeks !== undefined && { piCadenceWeeks }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "art.updated",
        resourceType: "art",
        resourceId: id,
        ipAddress,
        userAgent,
        changes: {
          ...(name !== undefined && { name: { before: existing.name, after: name } }),
          ...(piCadenceWeeks !== undefined && {
            piCadenceWeeks: { before: existing.piCadenceWeeks, after: piCadenceWeeks },
          }),
        },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `ART "${name}" already exists` });
      }
      throw e;
    });
}

export async function listArts(db: PrismaClient, tenantId: TenantId) {
  return db.art.findMany({
    where: { tenantId },
    include: {
      valueStream: { select: { id: true, name: true } },
      _count: { select: { pis: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getArt(db: PrismaClient, tenantId: TenantId, id: ArtId) {
  return db.art.findFirst({
    where: { id, tenantId },
    include: {
      valueStream: { select: { id: true, name: true } },
      pis: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
    },
  });
}
