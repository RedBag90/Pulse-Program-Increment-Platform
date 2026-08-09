import { z } from "zod";
import { createTeam, listTeams, listTenantTeams } from "@/modules/core/org/server/services/team";
import { createMutationHandler } from "@/server/http/mutation-handler";
import { createQueryHandler } from "@/server/http/query-handler";
import type { ArtId } from "@/modules/core/kernel/domain/types";

const createSchema = z.object({
  artId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

// artId optional: mit artId die Teams einer ART, ohne alle Tenant-Teams (Goal-Picker).
const listParamsSchema = z.object({ artId: z.string().uuid().optional() });

export const GET = createQueryHandler({
  params: listParamsSchema,
  query: (ctx, { artId }) =>
    artId
      ? listTeams(ctx.db, ctx.principal.tenantId, artId as ArtId)
      : listTenantTeams(ctx.db, ctx.principal.tenantId),
});

export const POST = createMutationHandler({
  schema: createSchema,
  action: "team.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) => createTeam(ctx, { artId: input.artId as ArtId, name: input.name }),
});
