import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, FeatureId, StoryId, SprintId, PiId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreateStoryInput {
  tenantId: TenantId;
  actorId: UserId;
  parentId: FeatureId;
  piId?: PiId | undefined;
  sprintId?: SprintId | undefined;
  title: string;
  description?: string | undefined;
  acceptanceCriteria?: string[] | undefined;
  storyPoints?: number | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateStoryInput {
  tenantId: TenantId;
  actorId: UserId;
  id: StoryId;
  title?: string | undefined;
  description?: string | undefined;
  acceptanceCriteria?: string[] | undefined;
  storyPoints?: number | undefined;
  sprintId?: SprintId | null | undefined;
  status?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createStory(
  db: PrismaClient,
  input: CreateStoryInput,
): Promise<Result<{ id: StoryId }>> {
  const {
    tenantId,
    actorId,
    parentId,
    piId,
    sprintId,
    title,
    description,
    acceptanceCriteria,
    storyPoints,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      const feature = await tx.initiative.findFirst({
        where: { id: parentId, tenantId, level: InitiativeLevel.FEATURE, deletedAt: null },
      });
      if (!feature) {
        return err({ kind: "not_found" as const, resourceType: "Feature", id: parentId });
      }

      const path = `${feature.path}/${crypto.randomUUID()}`;

      const story = await tx.initiative.create({
        data: {
          tenantId,
          level: InitiativeLevel.STORY,
          parentId,
          path,
          title,
          ...(description !== undefined && { description }),
          ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
          ...(storyPoints !== undefined && { storyPoints }),
          ...(piId !== undefined && { piId }),
          ...(sprintId !== undefined && { sprintId }),
          ownerId: actorId,
          assigneeIds: [],
          createdBy: actorId,
          updatedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "initiative",
        resourceId: story.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: story.id as StoryId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function updateStory(
  db: PrismaClient,
  input: UpdateStoryInput,
): Promise<Result<void>> {
  const {
    tenantId,
    actorId,
    id,
    title,
    description,
    acceptanceCriteria,
    storyPoints,
    sprintId,
    status,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.initiative.findFirst({
        where: { id, tenantId, level: InitiativeLevel.STORY, deletedAt: null },
      });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Story", id });
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (status !== undefined && status !== existing.status) {
        changes["status"] = { before: existing.status, after: status };
      }

      await tx.initiative.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
          ...(storyPoints !== undefined && { storyPoints }),
          ...(sprintId !== undefined && { sprintId }),
          ...(status !== undefined && { status }),
          updatedBy: actorId,
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

export async function listStories(db: PrismaClient, tenantId: TenantId, featureId: FeatureId) {
  return db.initiative.findMany({
    where: { tenantId, parentId: featureId, level: InitiativeLevel.STORY, deletedAt: null },
    include: {
      sprint: { select: { id: true, indexInPi: true, team: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getStory(db: PrismaClient, tenantId: TenantId, id: StoryId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.STORY, deletedAt: null },
    include: {
      parent: { select: { id: true, title: true, artId: true } },
      sprint: {
        select: {
          id: true,
          indexInPi: true,
          startDate: true,
          endDate: true,
          team: { select: { id: true, name: true } },
        },
      },
      children: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, estimateHours: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function deleteStory(
  db: PrismaClient,
  tenantId: TenantId,
  actorId: UserId,
  id: StoryId,
): Promise<Result<void>> {
  const existing = await db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.STORY, deletedAt: null },
  });
  if (!existing) return err({ kind: "not_found" as const, resourceType: "Story", id });

  await db.initiative.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actorId },
  });

  return ok(undefined);
}
