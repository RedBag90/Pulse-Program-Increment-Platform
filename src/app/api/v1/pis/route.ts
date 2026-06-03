import { z } from "zod";
import { createPi, listPis } from "@/server/services/pi";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import type { ArtId, TimelineId } from "@/domain/types";

const createSchema = z.object({
  timelineId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

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

export const POST = createMutationHandler({
  schema: createSchema,
  action: "pi.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createPi(ctx, {
      timelineId: input.timelineId as TimelineId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    }),
});
