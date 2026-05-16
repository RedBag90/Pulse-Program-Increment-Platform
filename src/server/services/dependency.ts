import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, InitiativeId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";
import { detectCycle } from "@/domain/dependency-graph";

export type DependencyType = "blocks" | "depends_on" | "relates_to";

export interface LinkDependencyInput {
  tenantId: TenantId;
  actorId: UserId;
  fromId: InitiativeId;
  toId: InitiativeId;
  type: DependencyType;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UnlinkDependencyInput {
  tenantId: TenantId;
  actorId: UserId;
  fromId: InitiativeId;
  toId: InitiativeId;
  type: DependencyType;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function linkDependency(
  db: PrismaClient,
  input: LinkDependencyInput,
): Promise<Result<{ id: string }>> {
  const { tenantId, actorId, fromId, toId, type, ipAddress, userAgent } = input;

  if (fromId === toId) {
    return err({ kind: "conflict" as const, reason: "An initiative cannot depend on itself" });
  }

  return db
    .$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.initiative.findFirst({ where: { id: fromId, tenantId, deletedAt: null } }),
        tx.initiative.findFirst({ where: { id: toId, tenantId, deletedAt: null } }),
      ]);

      if (!from) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: fromId });
      }
      if (!to) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: toId });
      }

      if (type !== "relates_to") {
        const allEdges = await tx.dependency.findMany({
          where: { tenantId, type: { not: "relates_to" } },
          select: { fromId: true, toId: true },
        });
        if (detectCycle(fromId, toId, allEdges)) {
          return err({
            kind: "conflict" as const,
            reason: "This dependency would create a circular dependency chain",
          });
        }
      }

      const dep = await tx.dependency.create({
        data: { tenantId, fromId, toId, type, createdBy: actorId },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.dependency.linked",
        resourceType: "dependency",
        resourceId: dep.id,
        changes: {
          type: { before: null, after: type },
          fromId: { before: null, after: fromId },
          toId: { before: null, after: toId },
        },
        ipAddress,
        userAgent,
      });

      return ok({ id: dep.id });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: "This dependency already exists" });
      }
      throw e;
    });
}

export async function unlinkDependency(
  db: PrismaClient,
  input: UnlinkDependencyInput,
): Promise<Result<void>> {
  const { tenantId, actorId, fromId, toId, type, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const dep = await tx.dependency.findFirst({
        where: { fromId, toId, type, tenantId },
      });

      if (!dep) {
        return err({
          kind: "not_found" as const,
          resourceType: "Dependency",
          id: `${fromId}→${toId}`,
        });
      }

      await tx.dependency.delete({ where: { id: dep.id } });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.dependency.unlinked",
        resourceType: "dependency",
        resourceId: dep.id,
        changes: {
          type: { before: type, after: null },
          fromId: { before: fromId, after: null },
          toId: { before: toId, after: null },
        },
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listDependencies(
  db: PrismaClient,
  tenantId: TenantId,
  initiativeId: InitiativeId,
) {
  return db.dependency.findMany({
    where: {
      tenantId,
      OR: [{ fromId: initiativeId }, { toId: initiativeId }],
    },
    include: {
      from: { select: { id: true, title: true, level: true } },
      to: { select: { id: true, title: true, level: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
