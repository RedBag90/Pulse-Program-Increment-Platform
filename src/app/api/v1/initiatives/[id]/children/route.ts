import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";

const routeParamsSchema = z.object({ id: z.string().uuid() });

/** Direct children of an initiative (one level down). */
export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: async (ctx, { id }) => {
    const parent = await ctx.db.initiative.findFirst({
      where: { id, tenantId: ctx.principal.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) return null;

    return ctx.db.initiative.findMany({
      where: { parentId: id, tenantId: ctx.principal.tenantId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  },
});
