import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";
import { InitiativeLevel } from "@/domain/types";

const listParamsSchema = z.object({ artId: z.string().uuid().optional() });

/**
 * Features across the tenant ranked by computed WSJF score (descending).
 * Optional `?artId=` narrows the leaderboard to a single ART.
 */
export const GET = createQueryHandler({
  params: listParamsSchema,
  query: async (ctx, { artId }) => {
    const features = await ctx.db.initiative.findMany({
      where: {
        tenantId: ctx.principal.tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        ...(artId !== undefined && { artId }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        artId: true,
        piId: true,
        wsjfBusinessValue: true,
        wsjfTimeCriticality: true,
        wsjfRiskReduction: true,
        wsjfJobSize: true,
        wsjfComputed: true,
      },
      orderBy: { wsjfComputed: "desc" },
    });

    return features.map((f, i) => ({ rank: i + 1, ...f }));
  },
});
