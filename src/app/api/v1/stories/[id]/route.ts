import { z } from "zod";
import { getStory, updateStory, deleteStory } from "@/server/services/story";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { TenantId, StoryId, SprintId } from "@/domain/types";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  sprintId: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getStory(ctx.db, ctx.principal.tenantId as TenantId, id as StoryId),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: patchSchema,
    action: "story.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateStory(ctx, {
        id: id as StoryId,
        ...input,
        sprintId: input.sprintId === null ? null : (input.sprintId as SprintId | undefined),
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: z.object({}),
    action: "story.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx) => deleteStory(ctx, { id: id as StoryId }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
