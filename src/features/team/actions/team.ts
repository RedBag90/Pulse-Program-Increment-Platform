"use server";

import { z } from "zod";
import { createTeam, updateTeam, deleteTeam } from "@/server/services/team";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { TEAM_TYPES } from "@/domain/team-type";
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      artId: f.string("artId"),
      name: f.string("name"),
    };
  },
  service: (ctx, input) => createTeam(ctx, { artId: input.artId as ArtId, name: input.name }),
  revalidate: "team",
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
    scrumMasterId: z.string().uuid().nullable().optional(),
    productOwnerId: z.string().uuid().nullable().optional(),
    teamType: z.enum(TEAM_TYPES).nullable().optional(),
  }),
  action: "team.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      id: f.string("id"),
      artId: f.string("artId"),
      name: f.nonEmptyString("name"),
      description: f.nonEmptyString("description"),
      headcount: f.nonEmptyString("headcount"),
      targetVelocity: f.nonEmptyString("targetVelocity"),
      // nullableString: absent → undefined (don't touch), matching the rteId
      // guard. Previously these used `|| null`, which cleared the field whenever
      // a partial form omitted it.
      scrumMasterId: f.nullableString("scrumMasterId"),
      productOwnerId: f.nullableString("productOwnerId"),
      teamType: f.nullableString("teamType"),
    };
  },
  service: (ctx, input) =>
    updateTeam(ctx, {
      id: input.id as TeamId,
      name: input.name,
      description: input.description,
      headcount: input.headcount,
      targetVelocity: input.targetVelocity,
      scrumMasterId: input.scrumMasterId,
      productOwnerId: input.productOwnerId,
      teamType: input.teamType,
    }),
  revalidate: "team",
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
  parseFormData: (fd) => {
    const f = fields(fd);
    return { id: f.string("id"), artId: f.string("artId") };
  },
  service: (ctx, input) => deleteTeam(ctx, { id: input.id as TeamId }),
  revalidate: "team",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Team not found"
        : "Failed to delete team",
});
