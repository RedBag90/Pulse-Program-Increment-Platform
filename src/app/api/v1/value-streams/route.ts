import { z } from "zod";
import { createValueStream, listValueStreams } from "@/server/services/value-stream";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  budgetCurrency: z.string().length(3).optional(),
});

export const GET = createQueryHandler({
  query: (ctx) => listValueStreams(ctx.db, ctx.principal.tenantId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "value_stream.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createValueStream(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      name: input.name,
      description: input.description,
      budgetAmount: input.budgetAmount,
      budgetCurrency: input.budgetCurrency,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
});
