import { z } from "zod";
import { createEpic, listEpics } from "@/server/services/epic";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ValueStreamId } from "@/domain/types";

const createEpicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  valueStreamId: z.string().uuid(),
});

export const GET = createQueryHandler({
  query: (ctx) => listEpics(ctx.db, ctx.principal.tenantId),
});

export const POST = createMutationHandler({
  schema: createEpicSchema,
  action: "epic.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createEpic(ctx, {
      title: input.title,
      description: input.description,
      valueStreamId: input.valueStreamId as ValueStreamId,
    }),
});
