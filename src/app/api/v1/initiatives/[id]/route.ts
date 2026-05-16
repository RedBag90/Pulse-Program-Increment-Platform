import { z } from "zod";
import { getEpic, updateEpic } from "@/server/services/initiative";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { EpicId } from "@/domain/types";

const updateEpicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  leanBusinessCase: z.record(z.unknown()).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getEpic(ctx.db, ctx.principal.tenantId, id as EpicId),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateEpicSchema,
    action: "epic.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateEpic(ctx.db, {
        tenantId: ctx.principal.tenantId,
        actorId: ctx.principal.id,
        id: id as EpicId,
        ...input,
        ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
        ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
