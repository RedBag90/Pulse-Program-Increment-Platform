import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, InitiativeId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { canQaTransition, decisionTarget, type ReviewDecision } from "@/domain/initiative-status";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Initiative Review — the QS gate (`draft → in_review → approved`) for any
 * reviewable Initiative kind. Distinct from the L0–L5 stage gate; the pure
 * state machine lives in [initiative-status.ts]. Epic review is decided by the
 * VMO, Feature review by the RTE — but that authorization split lives in the
 * action shells, not here.
 *
 * The mutations are unified across kinds (their bodies were byte-identical);
 * the two read queries stay kind-specific because their projections genuinely
 * differ — each returns a render-ready row, so the dashboards never touch a
 * Prisma include shape.
 */

/** A reviewable Initiative kind. Drives the level filter and the error label. */
export type InitiativeKind = "epic" | "feature";

const KIND_CONFIG: Record<InitiativeKind, { level: InitiativeLevel; label: string }> = {
  epic: { level: InitiativeLevel.EPIC, label: "Epic" },
  feature: { level: InitiativeLevel.FEATURE, label: "Feature" },
};

// ---------------------------------------------------------------------------
// Mutations — submit (Owner) and decide (QS role). Audited, transactional.
// ---------------------------------------------------------------------------

/** Owner submits a draft Initiative for review: `draft → in_review`. */
export async function submitForReview(
  ctx: RequestContext,
  input: { kind: InitiativeKind; id: InitiativeId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { kind, id } = input;
  const cfg = KIND_CONFIG[kind];

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: cfg.level, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: cfg.label, id });
    if (!canQaTransition(existing.status, "in_review")) {
      return err({
        kind: "conflict" as const,
        reason: `${cfg.label} in status "${existing.status}" cannot be submitted for review`,
      });
    }

    await tx.initiative.update({
      where: { id },
      data: { status: "in_review", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: id,
        changes: { status: { before: existing.status, after: "in_review" } },
      },
    });
  });
}

/** QS role decides an in-review Initiative: approve → `approved`, reject → `draft`. */
export async function decideReview(
  ctx: RequestContext,
  input: { kind: InitiativeKind; id: InitiativeId; decision: ReviewDecision },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { kind, id, decision } = input;
  const cfg = KIND_CONFIG[kind];
  const target = decisionTarget(decision);

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: cfg.level, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: cfg.label, id });
    if (!canQaTransition(existing.status, target)) {
      return err({
        kind: "conflict" as const,
        reason: `${cfg.label} in status "${existing.status}" is not awaiting a review decision`,
      });
    }

    await tx.initiative.update({
      where: { id },
      data: { status: target, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: id,
        changes: { status: { before: existing.status, after: target } },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads — render-ready queues. Each returns exactly what its dashboard renders;
// Prisma include shapes never cross the seam.
// ---------------------------------------------------------------------------

/** A row of the VMO Epic-QS queue. */
export interface EpicReviewRow {
  id: string;
  title: string;
  href: string;
  valueStream: { id: string; name: string } | null;
}

/** A row of the RTE Feature-QS queue. */
export interface FeatureReviewRow {
  id: string;
  title: string;
  href: string;
  parentTitle: string | null;
  art: { id: string; name: string } | null;
}

/** Epics awaiting QA — backs the VMO dashboard. */
export async function listEpicsInReview(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<EpicReviewRow[]> {
  const rows = await db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, status: "in_review" },
    include: { valueStream: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    href: `/portfolio/epics/${r.id}`,
    valueStream: r.valueStream ? { id: r.valueStream.id, name: r.valueStream.name } : null,
  }));
}

/** Features awaiting QA — backs the Feature-QS dashboard; optionally ART-scoped. */
export async function listFeaturesInReview(
  db: PrismaClient,
  tenantId: TenantId,
  artIds?: string[],
): Promise<FeatureReviewRow[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      status: "in_review",
      ...(artIds && artIds.length > 0 ? { artId: { in: artIds } } : {}),
    },
    include: {
      parent: { select: { id: true, title: true } },
      art: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    href: `/feature/${r.id}`,
    parentTitle: r.parent?.title ?? null,
    art: r.art ? { id: r.art.id, name: r.art.name } : null,
  }));
}
