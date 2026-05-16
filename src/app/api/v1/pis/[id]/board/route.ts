import { z } from "zod";
import { getPi } from "@/server/services/pi";
import { createQueryHandler } from "@/server/http/query-handler";
import type { PiId } from "@/domain/types";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getPi(ctx.db, ctx.principal.tenantId, id as PiId),
});
