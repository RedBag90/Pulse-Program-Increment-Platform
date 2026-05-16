"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createPiObjective } from "@/server/services/pi-objective";
import { createServerAction } from "@/server/http/server-action";
import type { TenantId, PiId, TeamId } from "@/domain/types";

export const createPiObjectiveAction = createServerAction({
  schema: z.object({
    piId: z.string().uuid(),
    artId: z.string().uuid(),
    teamId: z.string().uuid(),
    title: z.string().min(1, "Title required").max(200),
    description: z.string().max(2000).optional(),
    businessValue: z.coerce.number().int().min(1).max(10).optional(),
    committed: z.coerce.boolean().optional(),
  }),
  action: "pi_objective.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId, teamId: input.teamId }),
  parseFormData: (fd) => ({
    piId: fd.get("piId"),
    artId: fd.get("artId"),
    teamId: fd.get("teamId"),
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    businessValue: fd.get("businessValue") || undefined,
    committed: fd.get("committed") === "true" ? "true" : "false",
  }),
  service: (ctx, input) =>
    createPiObjective(ctx.db, {
      tenantId: ctx.principal.tenantId as TenantId,
      actorId: ctx.principal.id,
      piId: input.piId as PiId,
      teamId: input.teamId as TeamId,
      title: input.title,
      description: input.description,
      businessValue: input.businessValue,
      committed: input.committed ?? true,
    }),
  onSuccess: () => revalidatePath("/art/[artId]/pi/[piId]/objectives", "page"),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to create objective"),
});
