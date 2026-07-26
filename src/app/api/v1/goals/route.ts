import { z } from "zod";
import { listGoalsForPicker } from "@/server/services/ziele";
import { createQueryHandler } from "@/server/http/query-handler";

/**
 * Ziel-Suche für die Drawer-Picker („Bestehendes Ziel verbinden" / Elternziel
 * setzen). `q` filtert per Titel; `excludeSubtreeOf` blendet den Knoten + seine
 * Nachfahren aus (Zyklus-Guard). Tenant-Scope via RLS.
 */
export const GET = createQueryHandler({
  params: z.object({
    q: z.string().optional(),
    excludeSubtreeOf: z.string().uuid().optional(),
  }),
  query: (ctx, { q, excludeSubtreeOf }) =>
    listGoalsForPicker(ctx.db, ctx.principal.tenantId, {
      ...(q ? { q } : {}),
      ...(excludeSubtreeOf ? { excludeSubtreeOf } : {}),
    }),
});
