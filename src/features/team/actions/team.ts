"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createTeam, updateTeam, deleteTeam } from "@/server/services/team";
import { createServerAction } from "@/server/http/server-action";
import type { ArtId, TeamId } from "@/domain/types";

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

export const updateTeamAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
  }),
  action: "team.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    id: fd.get("id"),
    artId: fd.get("artId"),
    name: fd.get("name") || undefined,
  }),
  service: (ctx, input) =>
    updateTeam(ctx.db, {
      tenantId: ctx.principal.tenantId,
      actorId: ctx.principal.id,
      id: input.id as TeamId,
      name: input.name,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
  onSuccess: () => revalidatePath("/art/[artId]/teams", "page"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Team not found"
        : "Failed to update team",
});

export const deleteTeamAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "team.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({ id: fd.get("id"), artId: fd.get("artId") }),
  service: (ctx, input) =>
    deleteTeam(
      ctx.db,
      ctx.principal.tenantId,
      input.id as TeamId,
      ctx.principal.id,
      ctx.ipAddress,
      ctx.userAgent,
    ),
  onSuccess: () => revalidatePath("/art/[artId]/teams", "page"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Team not found"
        : "Failed to delete team",
});
