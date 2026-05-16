import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, PiId, SprintId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export type ImpedimentId = string & { readonly __brand: "ImpedimentId" };
export type Severity = "low" | "medium" | "high" | "critical";
export type ImpedimentStatus = "open" | "escalated" | "resolved";

export interface CreateImpedimentInput {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  piId?: PiId | undefined;
  sprintId?: SprintId | undefined;
  title: string;
  description?: string | undefined;
  severity?: Severity | undefined;
}

export interface ResolveImpedimentInput {
  tenantId: TenantId;
  actorId: UserId;
  id: ImpedimentId;
  resolution: string;
}

export async function createImpediment(
  db: PrismaClient,
  input: CreateImpedimentInput,
): Promise<Result<{ id: ImpedimentId }>> {
  const { tenantId, actorId, artId, piId, sprintId, title, description, severity } = input;

  return db
    .$transaction(async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId } });
      if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: artId });

      const imp = await tx.impediment.create({
        data: {
          tenantId,
          artId,
          ...(piId !== undefined && { piId }),
          ...(sprintId !== undefined && { sprintId }),
          title,
          ...(description !== undefined && { description }),
          severity: severity ?? "medium",
          raisedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "impediment",
        resourceId: imp.id,
      });

      return ok({ id: imp.id as ImpedimentId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function escalateImpediment(
  db: PrismaClient,
  tenantId: TenantId,
  actorId: UserId,
  id: ImpedimentId,
): Promise<Result<void>> {
  const existing = await db.impediment.findFirst({ where: { id, tenantId } });
  if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
  if (existing.status !== "open")
    return err({ kind: "conflict" as const, reason: "Only open impediments can be escalated" });

  await db.impediment.update({ where: { id }, data: { status: "escalated" } });
  return ok(undefined);
}

export async function resolveImpediment(
  db: PrismaClient,
  input: ResolveImpedimentInput,
): Promise<Result<void>> {
  const { tenantId, actorId, id, resolution } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.impediment.findFirst({ where: { id, tenantId } });
      if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
      if (existing.status === "resolved")
        return err({ kind: "conflict" as const, reason: "Impediment is already resolved" });

      await tx.impediment.update({
        where: { id },
        data: { status: "resolved", resolution, resolvedAt: new Date(), resolvedBy: actorId },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "impediment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "resolved" } },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listImpediments(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  options?: { piId?: string; status?: string },
) {
  return db.impediment.findMany({
    where: {
      tenantId,
      artId,
      ...(options?.piId ? { piId: options.piId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}
