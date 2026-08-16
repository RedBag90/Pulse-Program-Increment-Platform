import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, InitiativeId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { toMutationContext, onUniqueConstraint } from "@/modules/core/kernel/server/mutation";
import {
  createEdge,
  deleteEdge,
  type DependencyType,
} from "@/modules/work/server/services/dependency-edge";

// `DependencyType` now lives with the edge primitive in Work (Drumbeat imports
// DOWN, ADR-0013). Re-exported here so existing `@/modules/drumbeat/.../dependency`
// importers keep working unchanged.
export type { DependencyType };

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

  // Validates the endpoints, then delegates the cycle-check + edge write + audit
  // to Work's `createEdge` primitive (the single owner of edge mutations). The
  // audit commits inside this transaction, so we no longer route through
  // `withAuditedTransaction`; the unique-constraint → conflict mapping stays
  // here at the transaction boundary, unchanged.
  try {
    return await mctx.db.$transaction(async (tx) => {
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

      const created = await createEdge(tx, mctx, { fromId, toId, type });
      if (isErr(created)) return created;
      return ok({ id: created.value.id });
    });
  } catch (e) {
    const mapped = onUniqueConstraint("This dependency already exists")(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function unlinkDependency(
  ctx: RequestContext,
  input: UnlinkDependencyInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { fromId, toId, type } = input;

  return mctx.db.$transaction(async (tx) => {
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

    await deleteEdge(tx, mctx, dep);
    return ok(undefined);
  });
}

export interface ChangeDependencyTypeInput {
  fromId: InitiativeId;
  toId: InitiativeId;
  fromType: DependencyType;
  toType: DependencyType;
}

/**
 * Netzplan Edge-Type-Wechsel (Roadmap-P2): tauscht den Typ eines
 * bestehenden Edges atomar aus (loescht + neu anlegt, ein Audit-Event
 * mit `before`/`after`). Cycle-Check fuer blocks/depends_on, weil eine
 * Typ-Erhebung von `relates_to` zu `blocks` einen latent vorhandenen
 * Zyklus exposen koennte (relates_to wurde im Cycle-Check ignoriert).
 */
export async function changeDependencyType(
  ctx: RequestContext,
  input: ChangeDependencyTypeInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { fromId, toId, fromType, toType } = input;

  if (fromType === toType) {
    return err({ kind: "conflict" as const, reason: "Type already matches" });
  }

  // Delegates to the edge primitive so the cycle-check lives in ONE place.
  // Deleting the old edge FIRST (silently — no `unlinked` audit) means
  // `createEdge`'s tenant-wide check naturally excludes the edge being retyped,
  // reproducing the old `NOT: { id: existing.id }` exclusion. `createEdge`'s
  // `auditBefore` collapses the swap into the SAME single `linked` before/after
  // event this function has always emitted.
  try {
    return await mctx.db.$transaction(async (tx) => {
      const existing = await tx.dependency.findFirst({
        where: { tenantId: mctx.tenantId, fromId, toId, type: fromType },
      });
      if (!existing) {
        return err({
          kind: "not_found" as const,
          resourceType: "Dependency",
          id: `${fromId}→${toId}:${fromType}`,
        });
      }

      await deleteEdge(tx, mctx, existing, { emitAudit: false });

      const created = await createEdge(
        tx,
        mctx,
        { fromId, toId, type: toType },
        {
          auditBefore: { type: fromType, fromId, toId },
          cycleReason: "This dependency type change would create a circular dependency chain",
        },
      );
      if (isErr(created)) return created;
      return ok({ id: created.value.id });
    });
  } catch (e) {
    const mapped = onUniqueConstraint("This dependency already exists")(e);
    if (mapped) return mapped;
    throw e;
  }
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
  return mctx.db.$transaction(async (tx) => {
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
    await deleteEdge(tx, mctx, dep);
    return ok(undefined);
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

/** One breakdown-network edge that has at least one endpoint among the Epic's
 *  Features. Cross-Epic endpoints carry their `parent` (the other Epic) so the
 *  network can render them as ghost-nodes with a click-through. */
export interface BreakdownDependencyEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  from: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  to: { id: string; title: string; parent: { id: string; title: string } | null } | null;
}

/**
 * Edges with MINDESTENS einem Endpunkt in `featureIds` — the raw material for an
 * Epic's breakdown network (Roadmap-N1 + P6). Drumbeat owns the `dependency`
 * table; the Epic route consumes this via a port so Work never reads it directly
 * (ADR-0013). Returns `[]` for an empty feature set.
 */
export async function listBreakdownDependencies(
  db: PrismaClient,
  tenantId: TenantId,
  featureIds: readonly string[],
): Promise<BreakdownDependencyEdge[]> {
  if (featureIds.length === 0) return [];
  return db.dependency.findMany({
    where: {
      tenantId,
      OR: [{ fromId: { in: featureIds as string[] } }, { toId: { in: featureIds as string[] } }],
    },
    select: {
      id: true,
      fromId: true,
      toId: true,
      type: true,
      from: {
        select: { id: true, title: true, parent: { select: { id: true, title: true } } },
      },
      to: {
        select: { id: true, title: true, parent: { select: { id: true, title: true } } },
      },
    },
  });
}
