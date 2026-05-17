import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, FeatureId, EpicId, ArtId, PiId, FibonacciValue } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import { validateParentLevel } from "@/domain/hierarchy";
import { computeWsjf } from "@/domain/schemas/initiative";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { paginate, type PageParams } from "@/server/db/paginate";

export interface CreateFeatureInput {
  parentId: EpicId;
  artId: ArtId;
  piId?: PiId | undefined;
  title: string;
  description?: string | undefined;
  wsjfBusinessValue: FibonacciValue;
  wsjfTimeCriticality: FibonacciValue;
  wsjfRiskReduction: FibonacciValue;
  wsjfJobSize: FibonacciValue;
  acceptanceCriteria?: string[] | undefined;
}

export interface UpdateFeatureInput {
  id: FeatureId;
  title?: string | undefined;
  description?: string | undefined;
  wsjfBusinessValue?: FibonacciValue | undefined;
  wsjfTimeCriticality?: FibonacciValue | undefined;
  wsjfRiskReduction?: FibonacciValue | undefined;
  wsjfJobSize?: FibonacciValue | undefined;
  acceptanceCriteria?: string[] | undefined;
  piId?: PiId | undefined;
}

export async function createFeature(
  ctx: RequestContext,
  input: CreateFeatureInput,
): Promise<Result<{ id: FeatureId }>> {
  const mctx = toMutationContext(ctx);
  const {
    parentId,
    artId,
    piId,
    title,
    description,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    acceptanceCriteria,
  } = input;

  const wsjfComputed = computeWsjf({
    businessValue: wsjfBusinessValue,
    timeCriticality: wsjfTimeCriticality,
    riskReduction: wsjfRiskReduction,
    jobSize: wsjfJobSize,
  });

  return withAuditedTransaction(mctx, async (tx) => {
    const parent = await tx.initiative.findFirst({
      where: { id: parentId, tenantId: mctx.tenantId, deletedAt: null },
    });
    const hierarchy = validateParentLevel(InitiativeLevel.FEATURE, parent, parentId);
    if (isErr(hierarchy)) return hierarchy;
    const epic = parent!; // non-null once validateParentLevel passes

    const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
    if (!art) {
      return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
    }

    const feature = await tx.initiative.create({
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        parentId,
        artId,
        path: "",
        title,
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        wsjfBusinessValue,
        wsjfTimeCriticality,
        wsjfRiskReduction,
        wsjfJobSize,
        wsjfComputed,
        acceptanceCriteria: acceptanceCriteria ?? [],
        ...(description !== undefined && { description }),
        ...(piId !== undefined && { piId }),
      },
    });

    await tx.initiative.update({
      where: { id: feature.id },
      data: { path: `${epic.path}.${feature.id}` },
    });

    return ok({
      result: { id: feature.id as FeatureId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: feature.id },
    });
  });
}

export async function updateFeature(
  ctx: RequestContext,
  input: UpdateFeatureInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const {
    id,
    title,
    description,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    acceptanceCriteria,
    piId,
  } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Feature", id });
    }

    const newBv = wsjfBusinessValue ?? (existing.wsjfBusinessValue as FibonacciValue);
    const newTc = wsjfTimeCriticality ?? (existing.wsjfTimeCriticality as FibonacciValue);
    const newRr = wsjfRiskReduction ?? (existing.wsjfRiskReduction as FibonacciValue);
    const newJs = wsjfJobSize ?? (existing.wsjfJobSize as FibonacciValue);

    const wsjfChanged =
      wsjfBusinessValue !== undefined ||
      wsjfTimeCriticality !== undefined ||
      wsjfRiskReduction !== undefined ||
      wsjfJobSize !== undefined;

    const newComputed = wsjfChanged
      ? computeWsjf({
          businessValue: newBv,
          timeCriticality: newTc,
          riskReduction: newRr,
          jobSize: newJs,
        })
      : undefined;

    // Scalar fields diff via the shared changelog helper; WSJF is a compound
    // field, so its before/after is built explicitly.
    const changes = buildChangelog(
      { title: existing.title },
      { ...(title !== undefined && { title }) },
      ["title"],
    );
    if (wsjfChanged) {
      changes["wsjf"] = {
        before: {
          bv: existing.wsjfBusinessValue,
          tc: existing.wsjfTimeCriticality,
          rr: existing.wsjfRiskReduction,
          js: existing.wsjfJobSize,
        },
        after: { bv: newBv, tc: newTc, rr: newRr, js: newJs },
      };
    }

    await tx.initiative.update({
      where: { id },
      data: {
        updatedBy: mctx.actorId,
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(wsjfBusinessValue !== undefined && { wsjfBusinessValue }),
        ...(wsjfTimeCriticality !== undefined && { wsjfTimeCriticality }),
        ...(wsjfRiskReduction !== undefined && { wsjfRiskReduction }),
        ...(wsjfJobSize !== undefined && { wsjfJobSize }),
        ...(newComputed !== undefined && { wsjfComputed: newComputed }),
        ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
        ...(piId !== undefined && { piId }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

export interface SetFeaturePiInput {
  featureId: FeatureId;
  /** Target PI, or null to move the feature back to the backlog. */
  piId: PiId | null;
}

/** Assign a feature to a PI (or back to the backlog). Enforces the same-ART rule. */
export async function setFeaturePi(
  ctx: RequestContext,
  input: SetFeaturePiInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { featureId, piId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const feature = await tx.initiative.findFirst({
      where: {
        id: featureId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
      },
    });
    if (!feature) {
      return err({ kind: "not_found" as const, resourceType: "Feature", id: featureId });
    }

    if (piId !== null) {
      const pi = await tx.programIncrement.findFirst({
        where: { id: piId, tenantId: mctx.tenantId },
      });
      if (!pi) {
        return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id: piId });
      }
      if (pi.artId !== feature.artId) {
        return err({
          kind: "conflict" as const,
          reason: "Feature and Program Increment belong to different ARTs",
        });
      }
    }

    await tx.initiative.update({
      where: { id: featureId },
      data: { piId, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: featureId,
        changes: { piId: { before: feature.piId, after: piId } },
      },
    });
  });
}

export interface ScoreFeatureInput {
  id: FeatureId;
  wsjfBusinessValue: FibonacciValue;
  wsjfTimeCriticality: FibonacciValue;
  wsjfRiskReduction: FibonacciValue;
  wsjfJobSize: FibonacciValue;
}

export async function scoreFeature(
  ctx: RequestContext,
  input: ScoreFeatureInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, wsjfBusinessValue, wsjfTimeCriticality, wsjfRiskReduction, wsjfJobSize } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Feature", id });

    const wsjfComputed = computeWsjf({
      businessValue: wsjfBusinessValue,
      timeCriticality: wsjfTimeCriticality,
      riskReduction: wsjfRiskReduction,
      jobSize: wsjfJobSize,
    });

    await tx.initiative.update({
      where: { id },
      data: {
        wsjfBusinessValue,
        wsjfTimeCriticality,
        wsjfRiskReduction,
        wsjfJobSize,
        wsjfComputed,
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "wsjf.scored",
        resourceType: "initiative",
        resourceId: id,
        changes: { wsjfComputed: { before: existing.wsjfComputed, after: wsjfComputed } },
      },
    });
  });
}

export async function listFeatures(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const where = { tenantId, artId, level: InitiativeLevel.FEATURE, deletedAt: null };
  const include = {
    parent: { select: { id: true, title: true } },
    pi: { select: { id: true, name: true } },
  };
  const orderBy = [{ wsjfComputed: "desc" as const }, { createdAt: "asc" as const }];

  return paginate(
    ({ take, skip }) => db.initiative.findMany({ where, include, orderBy, take, skip }),
    () => db.initiative.count({ where }),
    pageParams,
  );
}

export async function getFeature(db: PrismaClient, tenantId: TenantId, id: FeatureId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    include: {
      parent: { select: { id: true, title: true } },
      art: { select: { id: true, name: true } },
      pi: { select: { id: true, name: true } },
      children: {
        where: { deletedAt: null },
        select: { id: true, title: true, level: true, status: true, storyPoints: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Delete Feature (soft)
// ---------------------------------------------------------------------------

export async function softDeleteFeature(
  ctx: RequestContext,
  input: { id: FeatureId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Feature", id });

    await tx.initiative.updateMany({
      where: { parentId: id, tenantId: mctx.tenantId, level: InitiativeLevel.STORY },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    await tx.initiative.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.deleted", resourceType: "initiative", resourceId: id },
    });
  });
}
