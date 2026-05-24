import type { Prisma, Initiative } from "@/generated/prisma";
import type { InitiativeLevel } from "@/domain/types";
import { ok, err, isErr, type Result } from "@/domain/errors";
import { validateParentLevel } from "@/domain/hierarchy";
import { notDeleted } from "@/server/db/soft-delete";
import type { MutationContext } from "@/server/services/mutation";

// ---------------------------------------------------------------------------
// Initiative write module
//
// Every initiative — Epic, Feature, Story, Task — is a row in the `initiative`
// table discriminated by `level` (see CONTEXT.md). The create/update/delete
// skeletons were duplicated per level (story.ts and task.ts were near-clones).
// These primitives own that shared skeleton; they run *inside* the caller's
// `withAuditedTransaction`, so callers keep the audit envelope and can compose
// level-specific writes (Feature's WSJF, Epic's stage-gate) in the same tx.
// ---------------------------------------------------------------------------

/** The parent fields callers need after validation (path for the child's materialized path). */
export type ValidatedParent = Pick<Initiative, "id" | "level" | "path" | "artId">;

/** Optional initiative columns a child-level create may set. */
type ChildCreateData = Partial<
  Pick<
    Prisma.InitiativeUncheckedCreateInput,
    "description" | "acceptanceCriteria" | "storyPoints" | "piId" | "sprintId" | "estimateHours"
  >
>;

/**
 * Loads and validates the parent for a `childLevel` initiative (hierarchy
 * invariants I1 + I2). Excludes soft-deleted parents. Epic-level callers pass
 * `parentId = null` and receive `ok(null)`; everyone else gets the parent row.
 */
export async function findValidatedParent(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  childLevel: InitiativeLevel,
  parentId: string | null,
): Promise<Result<ValidatedParent | null>> {
  const parent = parentId
    ? await tx.initiative.findFirst({
        where: { id: parentId, tenantId: mctx.tenantId, ...notDeleted },
        select: { id: true, level: true, path: true, artId: true },
      })
    : null;

  const check = validateParentLevel(childLevel, parent, parentId ?? "");
  if (isErr(check)) return check;
  return ok(parent);
}

/**
 * The shared create-at-level skeleton for child initiatives (Story, Task):
 * derives the materialized path under the parent and stamps the tenant/owner/
 * author defaults. Returns the created row. Callers compose any extra writes
 * (e.g. publishing a domain event) on the same `tx`.
 */
export async function createChildInitiative(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  args: {
    level: InitiativeLevel;
    parentId: string;
    parentPath: string;
    title: string;
    data?: ChildCreateData;
  },
): Promise<Initiative> {
  const path = `${args.parentPath}/${crypto.randomUUID()}`;
  return tx.initiative.create({
    data: {
      ...args.data,
      tenantId: mctx.tenantId,
      level: args.level,
      parentId: args.parentId,
      path,
      title: args.title,
      ownerId: mctx.actorId,
      assigneeIds: [],
      createdBy: mctx.actorId,
      updatedBy: mctx.actorId,
    },
  });
}

/**
 * Loads a non-deleted initiative at a specific level, or returns a `not_found`
 * domain error tagged with `resourceType` (e.g. "Story"). Backs update/delete;
 * callers build their own changelog from the returned row and run the update.
 */
export async function findInitiativeAtLevel(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  args: { id: string; level: InitiativeLevel; resourceType: string },
): Promise<Result<Initiative>> {
  const existing = await tx.initiative.findFirst({
    where: { id: args.id, tenantId: mctx.tenantId, level: args.level, ...notDeleted },
  });
  if (!existing) {
    return err({ kind: "not_found" as const, resourceType: args.resourceType, id: args.id });
  }
  return ok(existing);
}

/**
 * Soft-deletes an initiative at a specific level (sets `deletedAt`), returning
 * the audited result so the caller can `return` it directly. Does not cascade —
 * callers with children (Feature, Epic) keep their own cascade logic.
 */
export async function softDeleteInitiativeAtLevel(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  args: { id: string; level: InitiativeLevel; resourceType: string },
): Promise<
  Result<{
    result: undefined;
    audit: { action: "initiative.deleted"; resourceType: "initiative"; resourceId: string };
  }>
> {
  const found = await findInitiativeAtLevel(tx, mctx, args);
  if (isErr(found)) return found;

  await tx.initiative.update({
    where: { id: args.id },
    data: { deletedAt: new Date(), updatedBy: mctx.actorId },
  });

  return ok({
    result: undefined,
    audit: {
      action: "initiative.deleted" as const,
      resourceType: "initiative" as const,
      resourceId: args.id,
    },
  });
}
