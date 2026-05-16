import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Role } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface VisibilityScope {
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
}

export interface AssignRoleInput {
  tenantId: TenantId;
  actorId: UserId;
  targetUserId: UserId;
  role: Role;
  scope: VisibilityScope;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface RemoveRoleInput {
  tenantId: TenantId;
  actorId: UserId;
  assignmentId: string;
  targetUserId: UserId;
  role: Role;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function assignRole(
  db: PrismaClient,
  input: AssignRoleInput,
): Promise<Result<{ id: string }>> {
  const { tenantId, actorId, targetUserId, role, scope, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId: targetUserId,
          tenantId,
          role,
          valueStreamIds: scope.valueStreamIds,
          artIds: scope.artIds,
          teamIds: scope.teamIds,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "user.role.assigned",
        resourceType: "user_role_assignment",
        resourceId: assignment.id,
        ipAddress,
        userAgent,
        changes: {
          role: { before: null, after: role },
          targetUserId: { before: null, after: targetUserId },
        },
      });

      return ok({ id: assignment.id });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `User already has role "${role}"` });
      }
      throw e;
    });
}

export async function removeRole(db: PrismaClient, input: RemoveRoleInput): Promise<Result<void>> {
  const { tenantId, actorId, assignmentId, targetUserId, role, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const deleted = await tx.userRoleAssignment.deleteMany({
        where: { id: assignmentId, tenantId, userId: targetUserId },
      });

      if (deleted.count === 0) {
        return err({
          kind: "not_found" as const,
          resourceType: "UserRoleAssignment",
          id: assignmentId,
        });
      }

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "user.role.removed",
        resourceType: "user_role_assignment",
        resourceId: assignmentId,
        ipAddress,
        userAgent,
        changes: {
          role: { before: role, after: null },
          targetUserId: { before: targetUserId, after: null },
        },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not_found"))
        return err({
          kind: "not_found" as const,
          resourceType: "UserRoleAssignment",
          id: assignmentId,
        });
      throw e;
    });
}

export async function listUserRoles(db: PrismaClient, tenantId: TenantId, userId: UserId) {
  return db.userRoleAssignment.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "asc" },
  });
}
