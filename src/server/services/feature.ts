import type { PrismaClient } from "@/generated/prisma";
import type {
  TenantId,
  UserId,
  FeatureId,
  EpicId,
  ArtId,
  PiId,
  FibonacciValue,
} from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";
import { computeWsjf } from "@/domain/schemas/initiative";

export interface CreateFeatureInput {
  tenantId: TenantId;
  actorId: UserId;
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
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateFeatureInput {
  tenantId: TenantId;
  actorId: UserId;
  id: FeatureId;
  title?: string | undefined;
  description?: string | undefined;
  wsjfBusinessValue?: FibonacciValue | undefined;
  wsjfTimeCriticality?: FibonacciValue | undefined;
  wsjfRiskReduction?: FibonacciValue | undefined;
  wsjfJobSize?: FibonacciValue | undefined;
  acceptanceCriteria?: string[] | undefined;
  piId?: PiId | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createFeature(
  db: PrismaClient,
  input: CreateFeatureInput,
): Promise<Result<{ id: FeatureId }>> {
  const {
    tenantId,
    actorId,
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
    ipAddress,
    userAgent,
  } = input;

  const wsjfComputed = computeWsjf({
    businessValue: wsjfBusinessValue,
    timeCriticality: wsjfTimeCriticality,
    riskReduction: wsjfRiskReduction,
    jobSize: wsjfJobSize,
  });

  return db
    .$transaction(async (tx) => {
      const epic = await tx.initiative.findFirst({
        where: { id: parentId, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      });
      if (!epic) {
        return err({ kind: "not_found" as const, resourceType: "Epic", id: parentId });
      }

      const art = await tx.art.findFirst({ where: { id: artId, tenantId } });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
      }

      const feature = await tx.initiative.create({
        data: {
          tenantId,
          level: InitiativeLevel.FEATURE,
          parentId,
          artId,
          path: "",
          title,
          ownerId: actorId,
          assigneeIds: [],
          createdBy: actorId,
          updatedBy: actorId,
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

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "initiative",
        resourceId: feature.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: feature.id as FeatureId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function updateFeature(
  db: PrismaClient,
  input: UpdateFeatureInput,
): Promise<Result<void>> {
  const {
    tenantId,
    actorId,
    id,
    title,
    description,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    acceptanceCriteria,
    piId,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.initiative.findFirst({
        where: { id, tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
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

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (title !== undefined && title !== existing.title) {
        changes["title"] = { before: existing.title, after: title };
      }
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
          updatedBy: actorId,
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

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: id,
        changes,
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export interface ScoreFeatureInput {
  tenantId: TenantId;
  actorId: UserId;
  id: FeatureId;
  wsjfBusinessValue: FibonacciValue;
  wsjfTimeCriticality: FibonacciValue;
  wsjfRiskReduction: FibonacciValue;
  wsjfJobSize: FibonacciValue;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function scoreFeature(
  db: PrismaClient,
  input: ScoreFeatureInput,
): Promise<Result<void>> {
  const {
    tenantId,
    actorId,
    id,
    wsjfBusinessValue,
    wsjfTimeCriticality,
    wsjfRiskReduction,
    wsjfJobSize,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.initiative.findFirst({
        where: { id, tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
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
          updatedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "wsjf.scored",
        resourceType: "initiative",
        resourceId: id,
        changes: { wsjfComputed: { before: existing.wsjfComputed, after: wsjfComputed } },
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listFeatures(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  return db.initiative.findMany({
    where: { tenantId, artId, level: InitiativeLevel.FEATURE, deletedAt: null },
    include: {
      parent: { select: { id: true, title: true } },
      pi: { select: { id: true, name: true } },
    },
    orderBy: [{ wsjfComputed: "desc" }, { createdAt: "asc" }],
  });
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
