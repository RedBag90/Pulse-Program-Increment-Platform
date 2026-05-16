import { z } from "zod";
import { getArt, updateArt } from "@/server/services/art";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ArtId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  piCadenceWeeks: z.number().int().min(8).max(12).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getArt(ctx.db, ctx.principal.tenantId, id as ArtId),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateSchema,
    action: "art.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateArt(ctx.db, {
        tenantId: ctx.principal.tenantId,
        actorId: ctx.principal.id,
        id: id as ArtId,
        ...input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
