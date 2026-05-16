import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { updateTeam } from "@/server/services/team";
import type { TeamId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateSchema,
    action: "team.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateTeam(ctx.db, {
        tenantId: ctx.principal.tenantId,
        actorId: ctx.principal.id,
        id: id as TeamId,
        ...input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
