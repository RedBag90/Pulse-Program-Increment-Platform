import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";
import { InitiativeLevel } from "@/domain/types";

const listParamsSchema = z.object({ artId: z.string().uuid().optional() });

/**
 * PI velocity: completed vs planned story points per Program Increment.
 * Optional `?artId=` narrows to a single ART.
 */
export const GET = createQueryHandler({
  params: listParamsSchema,
  query: async (ctx, { artId }) => {
    const pis = await ctx.db.programIncrement.findMany({
      where: { tenantId: ctx.principal.tenantId, ...(artId !== undefined && { artId }) },
      select: { id: true, name: true, startDate: true },
      orderBy: { startDate: "asc" },
    });

    const stories = await ctx.db.initiative.groupBy({
      by: ["piId", "status"],
      where: {
        tenantId: ctx.principal.tenantId,
        level: InitiativeLevel.STORY,
        deletedAt: null,
        piId: { in: pis.map((p) => p.id) },
      },
      _sum: { storyPoints: true },
    });

    return pis.map((pi) => {
      const rows = stories.filter((s) => s.piId === pi.id);
      const total = rows.reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
      const completed = rows
        .filter((r) => r.status === "completed" || r.status === "done")
        .reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
      return { piId: pi.id, piName: pi.name, completedPoints: completed, plannedPoints: total };
    });
  },
});
