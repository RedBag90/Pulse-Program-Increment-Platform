import { listTimelines } from "@/server/services/timeline";
import { createQueryHandler } from "@/server/http/query-handler";

export const GET = createQueryHandler({
  query: (ctx) => listTimelines(ctx.db, ctx.principal.tenantId),
});
