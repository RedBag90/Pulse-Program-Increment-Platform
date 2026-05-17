import { z } from "zod";
import { createFeature, listFeatures } from "@/server/services/feature";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { parsePageParams } from "@/server/db/paginate";
import { fibonacci } from "@/domain/schemas/initiative";
import type { ArtId, EpicId, PiId } from "@/domain/types";

const createSchema = z.object({
  parentId: z.string().uuid(),
  artId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  wsjfBusinessValue: fibonacci,
  wsjfTimeCriticality: fibonacci,
  wsjfRiskReduction: fibonacci,
  wsjfJobSize: fibonacci,
  acceptanceCriteria: z.array(z.string().min(1)).optional(),
});

const listParamsSchema = z.object({
  artId: z.string().uuid(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { artId, page, pageSize }) =>
    listFeatures(
      ctx.db,
      ctx.principal.tenantId,
      artId as ArtId,
      parsePageParams({ page, pageSize }),
    ),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    createFeature(ctx, {
      parentId: input.parentId as EpicId,
      artId: input.artId as ArtId,
      piId: input.piId as PiId | undefined,
      title: input.title,
      description: input.description,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      acceptanceCriteria: input.acceptanceCriteria,
    }),
});
