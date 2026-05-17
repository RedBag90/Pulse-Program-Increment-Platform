import { z } from "zod";
import { createPiObjective, listPiObjectives } from "@/server/services/pi-objective";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { PiId, TeamId } from "@/domain/types";

const createSchema = z.object({
  piId: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  businessValue: z.number().int().min(1).max(10).optional(),
  committed: z.boolean().optional(),
});

const listParamsSchema = z.object({
  piId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
});

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { piId, teamId }) =>
    listPiObjectives(
      ctx.db,
      ctx.principal.tenantId,
      piId as PiId,
      teamId !== undefined ? (teamId as TeamId) : undefined,
    ),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "pi_objective.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    createPiObjective(ctx, {
      piId: input.piId as PiId,
      teamId: input.teamId as TeamId,
      title: input.title,
      description: input.description,
      businessValue: input.businessValue,
      committed: input.committed,
    }),
});
