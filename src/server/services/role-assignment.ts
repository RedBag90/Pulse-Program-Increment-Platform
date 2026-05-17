import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Role } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

export interface VisibilityScope {
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
}

export interface AssignRoleInput {
  targetUserId: UserId;
  role: Role;
  scope: VisibilityScope;
}

export interface RemoveRoleInput {
  assignmentId: string;
  targetUserId: UserId;
  role: Role;
}

export async function assignRole(
  ctx: RequestContext,
  input: AssignRoleInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { targetUserId, role, scope } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const assignment = await tx.userRoleAssignment.create({
        data: {
          userId: targetUserId,
          tenantId: mctx.tenantId,
          role,
          valueStreamIds: scope.valueStreamIds,
          artIds: scope.artIds,
          teamIds: scope.teamIds,
        },
      });

      return ok({
        result: { id: assignment.id },
        audit: {
          action: "user.role.assigned",
          resourceType: "user_role_assignment",
          resourceId: assignment.id,
          changes: {
            role: { before: null, after: role },
            targetUserId: { before: null, after: targetUserId },
          },
        },
      });
    },
    { onPrismaError: onUniqueConstraint(`User already has role "${role}"`) },
  );
}

export async function removeRole(
  ctx: RequestContext,
  input: RemoveRoleInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { assignmentId, targetUserId, role } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const deleted = await tx.userRoleAssignment.deleteMany({
      where: { id: assignmentId, tenantId: mctx.tenantId, userId: targetUserId },
    });

    if (deleted.count === 0) {
      return err({
        kind: "not_found" as const,
        resourceType: "UserRoleAssignment",
        id: assignmentId,
      });
    }

    return ok({
      result: undefined,
      audit: {
        action: "user.role.removed",
        resourceType: "user_role_assignment",
        resourceId: assignmentId,
        changes: {
          role: { before: role, after: null },
          targetUserId: { before: targetUserId, after: null },
        },
      },
    });
  });
}

export async function listUserRoles(db: PrismaClient, tenantId: TenantId, userId: UserId) {
  return db.userRoleAssignment.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "asc" },
  });
}
