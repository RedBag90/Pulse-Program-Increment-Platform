import { z } from "zod";
import { createPi, listPis } from "@/server/services/pi";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import type { ArtId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
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
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    createPi(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      artId: input.artId as ArtId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
});
