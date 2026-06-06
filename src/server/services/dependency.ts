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

/**
 * By-id variant of `unlinkDependency` — feeds the bulk-unlink batch action
 * on the dependencies list page. The single-item action keeps the
 * `(fromId, toId, type)` lookup so existing callers don't churn.
 */
export async function unlinkDependencyById(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const dep = await tx.dependency.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
    });
    if (!dep) {
      return err({
        kind: "not_found" as const,
        resourceType: "Dependency",
        id: input.id,
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
          type: { before: dep.type, after: null },
          fromId: { before: dep.fromId, after: null },
          toId: { before: dep.toId, after: null },
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

/**
 * One-hop blocker-windows per Feature — feeds the "earliest possible PI"
 * derivation in `dependency-graph` / the PI-Planning overlay.
 *
 * Semantics: a Feature F is "blocked by" X when either
 *   • an edge `X → F` of type `blocks` exists (X actively blocks F), or
 *   • an edge `F → X` of type `depends_on` exists (F waits on X).
 * `relates_to` edges are purely informational and ignored. Returns one entry
 * per direct upstream constraint with the blocker's PI window (null when the
 * blocker is itself unscheduled).
 */
export async function getBlockerWindowsForFeatures(
  db: PrismaClient,
  tenantId: TenantId,
  featureIds: readonly string[],
): Promise<
  Map<string, { blockerId: string; blockerTitle: string; blockerEndDate: Date | null }[]>
> {
  const out = new Map<
    string,
    { blockerId: string; blockerTitle: string; blockerEndDate: Date | null }[]
  >();
  if (featureIds.length === 0) return out;

  const rows = await db.dependency.findMany({
    where: {
      tenantId,
      OR: [
        { type: "blocks", toId: { in: featureIds as string[] } },
        { type: "depends_on", fromId: { in: featureIds as string[] } },
      ],
    },
    include: {
      from: { select: { id: true, title: true, pi: { select: { endDate: true } } } },
      to: { select: { id: true, title: true, pi: { select: { endDate: true } } } },
    },
  });

  for (const r of rows) {
    // For 'blocks' the *from* side is the blocker; for 'depends_on' the *to* side is.
    const isBlocks = r.type === "blocks";
    const featureSide = isBlocks ? r.toId : r.fromId;
    const blocker = isBlocks ? r.from : r.to;
    const list = out.get(featureSide) ?? [];
    list.push({
      blockerId: blocker.id,
      blockerTitle: blocker.title,
      blockerEndDate: blocker.pi?.endDate ?? null,
    });
    out.set(featureSide, list);
  }
  return out;
}
