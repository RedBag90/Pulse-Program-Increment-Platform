import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const paramsSchema = z.object({
  id: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

/**
 * Full subtree of an initiative, cursor-paginated (concept §8.2). Descendants
 * are resolved via the materialized `path` column.
 */
export const GET = createQueryHandler({
  params: paramsSchema,
  query: async (ctx, { id, cursor, limit }) => {
    const root = await ctx.db.initiative.findFirst({
      where: { id, tenantId: ctx.principal.tenantId, deletedAt: null },
      select: { id: true, path: true },
    });
    if (!root) return null;

    const rows = await ctx.db.initiative.findMany({
      where: {
        tenantId: ctx.principal.tenantId,
        deletedAt: null,
        path: { startsWith: `${root.path}/` },
      },
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  },
});
