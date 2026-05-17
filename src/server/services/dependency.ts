import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, InitiativeId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { detectCycle } from "@/domain/dependency-graph";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

export type DependencyType = "blocks" | "depends_on" | "relates_to";

export interface LinkDependencyInput {
  fromId: InitiativeId;
  toId: InitiativeId;
  type: DependencyType;
}

export interface UnlinkDependencyInput {
  fromId: InitiativeId;
  toId: InitiativeId;
  type: DependencyType;
}

export async function linkDependency(
  ctx: RequestContext,
  input: LinkDependencyInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { fromId, toId, type } = input;

  if (fromId === toId) {
    return err({ kind: "conflict" as const, reason: "An initiative cannot depend on itself" });
  }

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const [from, to] = await Promise.all([
        tx.initiative.findFirst({
          where: { id: fromId, tenantId: mctx.tenantId, deletedAt: null },
        }),
        tx.initiative.findFirst({ where: { id: toId, tenantId: mctx.tenantId, deletedAt: null } }),
      ]);

      if (!from) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: fromId });
      }
      if (!to) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: toId });
      }

      if (type !== "relates_to") {
        const allEdges = await tx.dependency.findMany({
          where: { tenantId: mctx.tenantId, type: { not: "relates_to" } },
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
        data: { tenantId: mctx.tenantId, fromId, toId, type, createdBy: mctx.actorId },
      });

      return ok({
        result: { id: dep.id },
        audit: {
          action: "initiative.dependency.linked",
          resourceType: "dependency",
          resourceId: dep.id,
          changes: {
            type: { before: null, after: type },
            fromId: { before: null, after: fromId },
            toId: { before: null, after: toId },
          },
        },
      });
    },
    { onPrismaError: onUniqueConstraint("This dependency already exists") },
  );
}

export async function unlinkDependency(
  ctx: RequestContext,
  input: UnlinkDependencyInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { fromId, toId, type } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const dep = await tx.dependency.findFirst({
      where: { fromId, toId, type, tenantId: mctx.tenantId },
    });

    if (!dep) {
      return err({
        kind: "not_found" as const,
        resourceType: "Dependency",
        id: `${fromId}→${toId}`,
      });
    }

    await tx.dependency.delete({ where: { id: dep.id } });

    return ok({
      result: undefined,
      audit: {
        action: "initiative.dependency.unlinked",
        resourceType: "dependency",
        resourceId: dep.id,
        changes: {
          type: { before: type, after: null },
          fromId: { before: fromId, after: null },
          toId: { before: toId, after: null },
        },
      },
    });
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
