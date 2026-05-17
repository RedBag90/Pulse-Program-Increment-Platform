import { z } from "zod";
import { createTeam, listTeams } from "@/server/services/team";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ArtId } from "@/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

const listParamsSchema = z.object({ artId: z.string().uuid() });

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { artId }) => listTeams(ctx.db, ctx.principal.tenantId, artId as ArtId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "team.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => createTeam(ctx, { artId: input.artId as ArtId, name: input.name }),
});
