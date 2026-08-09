import { z } from "zod";
import { searchRelatedWork } from "@/modules/core/goals/server/services/ziele";
import { createQueryHandler } from "@/server/http/query-handler";

/**
 * Vereinheitlichtes „Related work"-Suchfeld im Ziel-Drawer: Volltext über Epics
 * + Features + PIs (`?q=`), je mit `type`-Diskriminator. Tenant-Scope via RLS.
 */
export const GET = createQueryHandler({
  params: z.object({ q: z.string().optional() }),
  query: (ctx, { q }) => searchRelatedWork(ctx.db, ctx.principal.tenantId, q ?? ""),
});
