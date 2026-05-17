import { z } from "zod";
import { updateValueStream, softDeleteValueStream } from "@/server/services/value-stream";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ValueStreamId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  budgetCurrency: z.string().length(3).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) =>
    ctx.db.valueStream.findFirst({
      where: { id, tenantId: ctx.principal.tenantId },
      include: { arts: true },
    }),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateSchema,
    action: "value_stream.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) => updateValueStream(ctx, { id: id as ValueStreamId, ...input }),
    successStatus: 204,
    idempotent: false,
  })(request);
}

export async function DELETE(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: z.object({}),
    action: "value_stream.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx) => softDeleteValueStream(ctx, { id: id as ValueStreamId }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
