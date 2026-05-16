import { z } from "zod";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { completePi } from "@/server/services/pi";
import type { PiId } from "@/domain/types";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: z.object({}),
    action: "pi.complete",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx) =>
      completePi(ctx.db, {
        tenantId: ctx.principal.tenantId,
        actorId: ctx.principal.id,
        id: id as PiId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
