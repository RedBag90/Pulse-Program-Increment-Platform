"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assignRole, removeRole } from "@/server/services/role-assignment";
import { createServerAction } from "@/server/http/server-action";
import { ROLES } from "@/domain/roles";
import type { Role } from "@/domain/roles";
import type { UserId } from "@/domain/types";
import { formatDomainError } from "@/server/http/domain-error-display";

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
  mapError: (e) => formatDomainError(e, { fallback: "Failed to assign role" }),
});

export const removeRoleAction = createServerAction({
  schema: z.object({
    assignmentId: z.string().uuid(),
    targetUserId: z.string().uuid(),
    role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
  }),
  action: "tenant.users.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    removeRole(ctx, {
      assignmentId: input.assignmentId,
      targetUserId: input.targetUserId as UserId,
      role: input.role,
    }),
  onSuccess: () => revalidatePath("/admin/users"),
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Role assignment not found",
      fallback: "Failed to remove role",
    }),
});
