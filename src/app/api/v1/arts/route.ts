import { z } from "zod";
import { createArt, listArts } from "@/server/services/art";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ValueStreamId } from "@/domain/types";

const createSchema = z.object({
  valueStreamId: z.string().uuid(),
  name: z.string().min(1).max(100),
  piCadenceWeeks: z.number().int().min(8).max(12).optional(),
});

export const GET = createQueryHandler({
  query: (ctx) => listArts(ctx.db, ctx.principal.tenantId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "art.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createArt(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      valueStreamId: input.valueStreamId as ValueStreamId,
      name: input.name,
      piCadenceWeeks: input.piCadenceWeeks,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
});
