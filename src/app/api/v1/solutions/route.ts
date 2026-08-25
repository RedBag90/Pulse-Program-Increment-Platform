import { createQueryHandler } from "@/server/http/query-handler";
import { notDeleted } from "@/server/db/soft-delete";

/**
 * Options-Liste der Solutions (für kaskadierende Selects, z. B. „Primär-Solution"
 * im Epic-Create-Dialog). RLS scoped auf den Tenant.
 */
export const GET = createQueryHandler({
  query: (ctx) =>
    ctx.db.solution.findMany({
      where: { tenantId: ctx.principal.tenantId, ...notDeleted },
      select: { id: true, name: true, horizon: true, valueStream: { select: { id: true } } },
      orderBy: { name: "asc" },
    }),
});
