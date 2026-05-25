import { z } from "zod";
import { createValueStream, listValueStreams } from "@/server/services/value-stream";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";

// Budget is no longer set manually — it derives from participatory-budgeting
// allocations per Value Stream (see getValueStreamBudgets).
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const GET = createQueryHandler({
  query: (ctx) => listValueStreams(ctx.db, ctx.principal.tenantId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "value_stream.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createValueStream(ctx, {
      name: input.name,
      description: input.description,
    }),
});
