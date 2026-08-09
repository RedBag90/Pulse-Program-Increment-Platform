import { listPiStandards } from "@/modules/drumbeat/server/services/pi-standard";
import { createQueryHandler } from "@/server/http/query-handler";

export const GET = createQueryHandler({
  query: (ctx) => listPiStandards(ctx.db, ctx.principal.tenantId),
});
