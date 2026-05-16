import { z } from "zod";
import { createStory, listStories } from "@/server/services/story";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import type { TenantId, FeatureId, PiId, SprintId } from "@/domain/types";

const createSchema = z.object({
  featureId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
});

const listParamsSchema = z.object({
  featureId: z.string().uuid(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { featureId, page, pageSize }) =>
    listStories(
      ctx.db,
      ctx.principal.tenantId as TenantId,
      featureId as FeatureId,
      parsePageParams({ page, pageSize }),
    ),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "story.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createStory(ctx.db, {
      tenantId: ctx.principal.tenantId as TenantId,
      actorId: ctx.principal.id,
      parentId: input.featureId as FeatureId,
      piId: input.piId as PiId | undefined,
      sprintId: input.sprintId as SprintId | undefined,
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      storyPoints: input.storyPoints,
    }),
});
