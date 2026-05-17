import { z } from "zod";
import { createTask, listTasks } from "@/server/services/task";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { TenantId, StoryId } from "@/domain/types";

const createSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  estimateHours: z.number().min(0.5).max(999).optional(),
});

const listParamsSchema = z.object({ storyId: z.string().uuid() });

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { storyId }) =>
    listTasks(ctx.db, ctx.principal.tenantId as TenantId, storyId as StoryId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "task.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createTask(ctx, {
      parentId: input.storyId as StoryId,
      title: input.title,
      description: input.description,
      estimateHours: input.estimateHours,
    }),
});
