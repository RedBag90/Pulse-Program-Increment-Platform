import { z } from "zod";
import { getPi, updatePi } from "@/server/services/pi";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { PiId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(["planned", "active", "completed"]).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getPi(ctx.db, ctx.principal.tenantId, id as PiId),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateSchema,
    action: "pi.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updatePi(ctx.db, {
        tenantId: ctx.principal.tenantId,
        actorId: ctx.principal.id,
        id: id as PiId,
        ...input,
        startDate: input.startDate !== undefined ? new Date(input.startDate) : undefined,
        endDate: input.endDate !== undefined ? new Date(input.endDate) : undefined,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
