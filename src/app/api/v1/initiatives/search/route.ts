import { z } from "zod";
import { createQueryHandler } from "@/server/http/query-handler";
import { searchInitiatives } from "@/server/services/initiative";

const paramsSchema = z.object({ q: z.string().optional() });

/** Title search across all initiative levels — backs the dependency picker. */
export const GET = createQueryHandler({
  params: paramsSchema,
  query: (ctx, { q }) => searchInitiatives(ctx.db, ctx.principal.tenantId, q ?? ""),
});
