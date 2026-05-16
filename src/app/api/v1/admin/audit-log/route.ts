import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const listParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  actorId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
});

/** Tenant audit log, filterable and cursor-paginated. Tenant Admin only. */
export const GET = createQueryHandler({
  params: listParamsSchema,
  readAction: "admin.audit-log.read",
  resource: (_params, principal) => ({ tenantId: principal.tenantId }),
  query: async (ctx, { cursor, limit, actorId, action, resourceType, since, until }) => {
    const rows = await ctx.db.auditEvent.findMany({
      where: {
        tenantId: ctx.principal.tenantId,
        ...(actorId !== undefined && { actorId }),
        ...(action !== undefined && { action }),
        ...(resourceType !== undefined && { resourceType }),
        ...((since !== undefined || until !== undefined) && {
          occurredAt: {
            ...(since !== undefined && { gte: new Date(since) }),
            ...(until !== undefined && { lte: new Date(until) }),
          },
        }),
      },
      orderBy: { occurredAt: "desc" },
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
