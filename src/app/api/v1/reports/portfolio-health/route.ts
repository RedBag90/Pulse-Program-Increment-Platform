import { createQueryHandler } from "@/server/http/query-handler";
import { InitiativeLevel } from "@/domain/types";

/** Portfolio health: epic counts by status and value-stream budget rollup. */
export const GET = createQueryHandler({
  query: async (ctx) => {
    const [epicGroups, valueStreams] = await Promise.all([
      ctx.db.initiative.groupBy({
        by: ["status"],
        where: { tenantId: ctx.principal.tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
        _count: { _all: true },
      }),
      ctx.db.valueStream.findMany({
        where: { tenantId: ctx.principal.tenantId },
        select: { id: true, name: true, budgetAmount: true, budgetCurrency: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const epicsByStatus = Object.fromEntries(epicGroups.map((g) => [g.status, g._count._all]));

    return {
      epicsByStatus,
      totalEpics: epicGroups.reduce((sum, g) => sum + g._count._all, 0),
      valueStreams,
    };
  },
});
