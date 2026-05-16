"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createTeam } from "@/server/services/team";
import { createServerAction } from "@/server/http/server-action";
import type { ArtId } from "@/domain/types";

export interface TeamActionState {
  error?: string;
  success?: boolean;
}

export const createTeamAction = createServerAction({
  schema: z.object({
    artId: z.string().uuid(),
    name: z.string().min(1).max(100),
  }),
  action: "team.create",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({
    artId: fd.get("artId"),
    name: fd.get("name"),
  }),
  service: (ctx, input) =>
    createTeam(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      artId: input.artId as ArtId,
      name: input.name,
      ...(ctx.ipAddress !== undefined && { ipAddress: ctx.ipAddress }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    }),
  onSuccess: () => revalidatePath("/art/[artId]/teams", "page"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "ART not found"
        : "Failed to create team",
});
