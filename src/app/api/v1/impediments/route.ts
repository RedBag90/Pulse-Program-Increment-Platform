import { z } from "zod";
import { createImpediment, listImpediments } from "@/server/services/impediment";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import type { TenantId, ArtId, PiId, SprintId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

const listParamsSchema = z.object({
  artId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { artId, piId, status, page, pageSize }) =>
    listImpediments(
      ctx.db,
      ctx.principal.tenantId as TenantId,
      artId as ArtId,
      { ...(piId !== undefined && { piId }), ...(status !== undefined && { status }) },
      parsePageParams({ page, pageSize }),
    ),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "impediment.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    createImpediment(ctx, {
      artId: input.artId as ArtId,
      piId: input.piId as PiId | undefined,
      sprintId: input.sprintId as SprintId | undefined,
      title: input.title,
      description: input.description,
      severity: input.severity,
    }),
});
