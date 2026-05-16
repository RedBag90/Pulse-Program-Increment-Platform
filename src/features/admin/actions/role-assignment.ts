"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { assignRole, removeRole } from "@/server/services/role-assignment";
import { ROLES } from "@/domain/roles";
import { headers } from "next/headers";
import { extractRequestMeta } from "@/server/audit/emit";
import { isErr } from "@/domain/errors";
import type { Role } from "@/domain/roles";
import type { UserId } from "@/domain/types";

const assignRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
  valueStreamIds: z.string().transform((s) => (s ? s.split(",").filter(Boolean) : [])),
  artIds: z.string().transform((s) => (s ? s.split(",").filter(Boolean) : [])),
  teamIds: z.string().transform((s) => (s ? s.split(",").filter(Boolean) : [])),
});

const removeRoleSchema = z.object({
  assignmentId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
});

export interface RoleAssignmentState {
  error?: string;
  success?: boolean;
}

export async function assignRoleAction(
  _prev: RoleAssignmentState,
  formData: FormData,
): Promise<RoleAssignmentState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const isAdmin =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!isAdmin) return { error: "Insufficient permissions" };

  const parsed = assignRoleSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
    valueStreamIds: formData.get("valueStreamIds") ?? "",
    artIds: formData.get("artIds") ?? "",
    teamIds: formData.get("teamIds") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await assignRole(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    targetUserId: parsed.data.targetUserId as UserId,
    role: parsed.data.role,
    scope: {
      valueStreamIds: parsed.data.valueStreamIds,
      artIds: parsed.data.artIds,
      teamIds: parsed.data.teamIds,
    },
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error: result.error.kind === "conflict" ? result.error.reason : "Failed to assign role",
    };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function removeRoleAction(
  _prev: RoleAssignmentState,
  formData: FormData,
): Promise<RoleAssignmentState> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return { error: "Not authenticated" };

  const isAdmin =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!isAdmin) return { error: "Insufficient permissions" };

  const parsed = removeRoleSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await removeRole(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    assignmentId: parsed.data.assignmentId,
    targetUserId: parsed.data.targetUserId as UserId,
    role: parsed.data.role,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    return {
      error:
        result.error.kind === "not_found" ? "Role assignment not found" : "Failed to remove role",
    };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
