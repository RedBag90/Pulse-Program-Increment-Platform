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
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Team", href: `/team/${v.id}` }),
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
  service: (ctx, input) => createTeam(ctx, { artId: input.artId as ArtId, name: input.name }),
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
    description: z.string().optional(),
    headcount: z.coerce.number().int().min(0).max(1000).optional(),
    targetVelocity: z.coerce.number().int().min(0).max(1000).optional(),
  }),
  action: "team.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => ({
    id: fd.get("id"),
    artId: fd.get("artId"),
    name: fd.get("name") || undefined,
    description: fd.get("description") || undefined,
    headcount: fd.get("headcount") || undefined,
    targetVelocity: fd.get("targetVelocity") || undefined,
  }),
  service: (ctx, input) =>
    updateTeam(ctx, {
      id: input.id as TeamId,
      name: input.name,
      description: input.description,
      headcount: input.headcount,
      targetVelocity: input.targetVelocity,
    }),
  onSuccess: () => {
    revalidatePath("/art/[artId]/teams", "page");
    revalidatePath("/capacity/teams/[id]", "page");
    revalidatePath("/capacity/arts/[id]", "page");
  },
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
  service: (ctx, input) => deleteTeam(ctx, { id: input.id as TeamId }),
  onSuccess: () => revalidatePath("/art/[artId]/teams", "page"),
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Team not found"
        : "Failed to delete team",
});
