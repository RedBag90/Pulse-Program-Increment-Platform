import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ValueStreamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreateValueStreamInput {
  tenantId: TenantId;
  actorId: UserId;
  name: string;
  description?: string | undefined;
  budgetAmount?: string | undefined;
  budgetCurrency?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateValueStreamInput {
  tenantId: TenantId;
  actorId: UserId;
  id: ValueStreamId;
  name?: string | undefined;
  description?: string | undefined;
  budgetAmount?: string | undefined;
  budgetCurrency?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createValueStream(
  db: PrismaClient,
  input: CreateValueStreamInput,
): Promise<Result<{ id: ValueStreamId }>> {
  const {
    tenantId,
    actorId,
    name,
    description,
    budgetAmount,
    budgetCurrency,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      const vs = await tx.valueStream.create({
        data: {
          tenantId,
          name,
          ...(description !== undefined && { description }),
          ...(budgetAmount !== undefined && { budgetAmount }),
          ...(budgetCurrency !== undefined && { budgetCurrency }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "value_stream",
        resourceId: vs.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: vs.id as ValueStreamId });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `Value stream "${name}" already exists` });
      }
      throw e;
    });
}

export async function updateValueStream(
  db: PrismaClient,
  input: UpdateValueStreamInput,
): Promise<Result<void>> {
  const { tenantId, actorId, id, ipAddress, userAgent, ...fields } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.valueStream.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id });
      }

      await tx.valueStream.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.budgetAmount !== undefined && { budgetAmount: fields.budgetAmount }),
          ...(fields.budgetCurrency !== undefined && { budgetCurrency: fields.budgetCurrency }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "value_stream",
        resourceId: id,
        ipAddress,
        userAgent,
        changes: {
          ...(fields.name !== undefined && { name: { before: existing.name, after: fields.name } }),
        },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({
          kind: "conflict" as const,
          reason: `Value stream "${fields.name}" already exists`,
        });
      }
      throw e;
    });
}

export async function softDeleteValueStream(
  db: PrismaClient,
  tenantId: TenantId,
  id: ValueStreamId,
  actorId: UserId,
  ipAddress?: string | undefined,
  userAgent?: string | undefined,
): Promise<Result<void>> {
  return db
    .$transaction(async (tx) => {
      const existing = await tx.valueStream.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id });
      }

      // ValueStream doesn't have deletedAt in the schema — we use a naming convention
      // for soft-delete: prefix the name with __deleted__ and store deletion timestamp.
      // A proper soft-delete column can be added in a future migration.
      await tx.valueStream.update({
        where: { id },
        data: { name: `__deleted__${Date.now()}__${existing.name}` },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.deleted",
        resourceType: "value_stream",
        resourceId: id,
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not_found"))
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id });
      throw e;
    });
}

export async function listValueStreams(db: PrismaClient, tenantId: TenantId) {
  return db.valueStream.findMany({
    where: { tenantId, name: { not: { startsWith: "__deleted__" } } },
    include: { arts: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}
