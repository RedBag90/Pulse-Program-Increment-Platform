"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assignRole, removeRole } from "@/server/services/role-assignment";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { ROLES } from "@/domain/roles";
import type { Role } from "@/domain/roles";
import type { UserId } from "@/domain/types";

export interface RoleAssignmentState {
  error?: string;
  success?: boolean;
}

export const assignRoleAction = createServerAction({
  schema: z.object({
    targetUserId: z.string().uuid(),
    role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
    valueStreamIds: z.string(),
    artIds: z.string(),
    teamIds: z.string(),
  }),
  action: "tenant.users.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      targetUserId: f.string("targetUserId"),
      role: f.string("role"),
      // Hidden comma-joined inputs; absent → "" so the schema's z.string() holds.
      valueStreamIds: f.string("valueStreamIds") ?? "",
      artIds: f.string("artIds") ?? "",
      teamIds: f.string("teamIds") ?? "",
    };
  },
  service: (ctx, input) =>
    assignRole(ctx, {
      targetUserId: input.targetUserId as UserId,
      role: input.role,
      scope: {
        valueStreamIds: input.valueStreamIds.split(",").filter(Boolean),
        artIds: input.artIds.split(",").filter(Boolean),
        teamIds: input.teamIds.split(",").filter(Boolean),
      },
    }),
  onSuccess: () => revalidatePath("/admin/users"),
  mapError: (e) => (e.kind === "conflict" ? e.reason : "Failed to assign role"),
});

export const removeRoleAction = createServerAction({
  schema: z.object({
    assignmentId: z.string().uuid(),
    targetUserId: z.string().uuid(),
    role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
  }),
  action: "tenant.users.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      assignmentId: f.string("assignmentId"),
      targetUserId: f.string("targetUserId"),
      role: f.string("role"),
    };
  },
  service: (ctx, input) =>
    removeRole(ctx, {
      assignmentId: input.assignmentId,
      targetUserId: input.targetUserId as UserId,
      role: input.role,
    }),
  onSuccess: () => revalidatePath("/admin/users"),
  mapError: (e) => (e.kind === "not_found" ? "Role assignment not found" : "Failed to remove role"),
});
