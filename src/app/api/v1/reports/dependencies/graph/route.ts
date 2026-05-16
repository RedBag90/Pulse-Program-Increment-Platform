import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";

const listParamsSchema = z.object({ piId: z.string().uuid().optional() });

/**
 * Dependency graph as nodes + edges. Optional `?piId=` scopes the graph to
 * features in one Program Increment (plus any initiatives they link to).
 */
export const GET = createQueryHandler({
  params: listParamsSchema,
  query: async (ctx, { piId }) => {
    const scopedInitiatives = await ctx.db.initiative.findMany({
      where: {
        tenantId: ctx.principal.tenantId,
        deletedAt: null,
        ...(piId !== undefined && { piId }),
      },
      select: { id: true },
    });
    const scopedIds = scopedInitiatives.map((i) => i.id);

    const edges = await ctx.db.dependency.findMany({
      where: {
        tenantId: ctx.principal.tenantId,
        OR: [{ fromId: { in: scopedIds } }, { toId: { in: scopedIds } }],
      },
      select: { id: true, fromId: true, toId: true, type: true },
    });

    // Node set: scoped initiatives plus any endpoints referenced by edges.
    const nodeIds = new Set<string>(scopedIds);
    for (const e of edges) {
      nodeIds.add(e.fromId);
      nodeIds.add(e.toId);
    }

    const nodes = await ctx.db.initiative.findMany({
      where: { id: { in: [...nodeIds] }, tenantId: ctx.principal.tenantId },
      select: { id: true, title: true, level: true, status: true, piId: true },
    });

    return { nodes, edges };
  },
});
