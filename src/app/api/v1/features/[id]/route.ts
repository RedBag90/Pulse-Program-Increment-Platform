import { z } from "zod";
import { getFeature, updateFeature } from "@/server/services/feature";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import { fibonacci } from "@/domain/schemas/initiative";
import type { FeatureId, PiId } from "@/domain/types";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  wsjfBusinessValue: fibonacci.optional(),
  wsjfTimeCriticality: fibonacci.optional(),
  wsjfRiskReduction: fibonacci.optional(),
  wsjfJobSize: fibonacci.optional(),
  acceptanceCriteria: z.array(z.string().min(1)).optional(),
  piId: z.string().uuid().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

const routeParamsSchema = z.object({ id: z.string().uuid() });

export const GET = createQueryHandler({
  params: routeParamsSchema,
  query: (ctx, { id }) => getFeature(ctx.db, ctx.principal.tenantId, id as FeatureId),
});

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return createMutationHandler({
    schema: updateSchema,
    action: "feature.update",
    resource: (_input, p) => ({ tenantId: p.tenantId }),
    service: (ctx, input) =>
      updateFeature(ctx, {
        id: id as FeatureId,
        ...input,
        piId: input.piId as PiId | undefined,
      }),
    successStatus: 204,
    idempotent: false,
  })(request);
}
