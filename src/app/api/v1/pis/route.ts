import { z } from "zod";
import { listPis } from "@/modules/drumbeat/server/services/pi";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import type { ArtId } from "@/modules/core/kernel/domain/types";

// PIs werden zentral über Timeline-Standards erzeugt (siehe
// `applyPiStandard` / `addStandardPisAction`); ein REST-POST für einzelne
// PIs würde diesen Pfad unterlaufen und wurde deshalb entfernt. GET bleibt
// als Listen-Endpoint für Integrations- und Sync-Konsumenten.

const listParamsSchema = z.object({
  artId: z.string().uuid(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { artId, page, pageSize }) =>
    listPis(ctx.db, ctx.principal.tenantId, artId as ArtId, parsePageParams({ page, pageSize })),
});
