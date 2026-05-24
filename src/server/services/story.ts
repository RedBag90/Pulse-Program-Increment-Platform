import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, FeatureId, StoryId, SprintId, PiId, ArtId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import { publishDomainEvent } from "@/server/events/publish";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import {
  findValidatedParent,
  createChildInitiative,
  findInitiativeAtLevel,
  softDeleteInitiativeAtLevel,
} from "@/server/services/initiative-write";
import { paginate, type PageParams } from "@/server/db/paginate";

export interface CreateStoryInput {
  parentId: FeatureId;
  piId?: PiId | undefined;
  sprintId?: SprintId | undefined;
  title: string;
  description?: string | undefined;
  acceptanceCriteria?: string[] | undefined;
  storyPoints?: number | undefined;
}

export interface UpdateStoryInput {
  id: StoryId;
  title?: string | undefined;
  description?: string | undefined;
  acceptanceCriteria?: string[] | undefined;
  storyPoints?: number | undefined;
  sprintId?: SprintId | null | undefined;
  status?: string | undefined;
}

export async function createStory(
  ctx: RequestContext,
  input: CreateStoryInput,
): Promise<Result<{ id: StoryId }>> {
  const mctx = toMutationContext(ctx);
  const { parentId, piId, sprintId, title, description, acceptanceCriteria, storyPoints } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const parentResult = await findValidatedParent(tx, mctx, InitiativeLevel.STORY, parentId);
    if (isErr(parentResult)) return parentResult;
    const feature = parentResult.value!; // non-null for a STORY's FEATURE parent

    const story = await createChildInitiative(tx, mctx, {
      level: InitiativeLevel.STORY,
      parentId,
      parentPath: feature.path,
      title,
      data: {
        ...(description !== undefined && { description }),
        ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
        ...(storyPoints !== undefined && { storyPoints }),
        ...(piId !== undefined && { piId }),
        ...(sprintId !== undefined && { sprintId }),
      },
    });

    await publishDomainEvent(tx, {
      type: "story.created",
      tenantId: mctx.tenantId,
      storyId: story.id as StoryId,
      artId: feature.artId as ArtId,
      title: story.title,
      description: story.description ?? null,
      storyPoints: story.storyPoints ?? null,
    });

    return ok({
      result: { id: story.id as StoryId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: story.id },
    });
  });
}

export async function updateStory(
  ctx: RequestContext,
  input: UpdateStoryInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, description, acceptanceCriteria, storyPoints, sprintId, status } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const found = await findInitiativeAtLevel(tx, mctx, {
      id,
      level: InitiativeLevel.STORY,
      resourceType: "Story",
    });
    if (isErr(found)) return found;
    const existing = found.value;

    const changes = buildChangelog(
      { status: existing.status },
      { ...(status !== undefined && { status }) },
      ["status"],
    );

    await tx.initiative.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
        ...(storyPoints !== undefined && { storyPoints }),
        ...(sprintId !== undefined && { sprintId }),
        ...(status !== undefined && { status }),
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

export async function deleteStory(
  ctx: RequestContext,
  input: { id: StoryId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, (tx) =>
    softDeleteInitiativeAtLevel(tx, mctx, {
      id,
      level: InitiativeLevel.STORY,
      resourceType: "Story",
    }),
  );
}

export async function listStories(
  db: PrismaClient,
  tenantId: TenantId,
  featureId: FeatureId,
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const where = { tenantId, parentId: featureId, level: InitiativeLevel.STORY, deletedAt: null };
  const include = {
    sprint: { select: { id: true, indexInPi: true, team: { select: { name: true } } } },
  };
  const orderBy = { createdAt: "asc" as const };

  return paginate(
    ({ take, skip }) => db.initiative.findMany({ where, include, orderBy, take, skip }),
    () => db.initiative.count({ where }),
    pageParams,
  );
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
