import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

/**
 * Collects everything Pulse holds about a user within a tenant, for a GDPR
 * data-export (right of access). PII (email/name) lives in Supabase Auth and is
 * fetched separately by the caller.
 */
export async function exportUserData(db: PrismaClient, tenantId: TenantId, userId: UserId) {
  const [roleAssignments, ownedInitiatives, raisedImpediments, auditEvents] = await Promise.all([
    db.userRoleAssignment.findMany({ where: { tenantId, userId } }),
    db.initiative.findMany({
      where: { tenantId, ownerId: userId },
      select: { id: true, level: true, title: true, status: true, createdAt: true },
    }),
    db.impediment.findMany({
      where: { tenantId, raisedBy: userId },
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    db.auditEvent.findMany({
      where: { tenantId, actorId: userId },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return {
    userId,
    tenantId,
    exportedAt: new Date().toISOString(),
    roleAssignments,
    ownedInitiatives,
    raisedImpediments,
    auditEvents,
  };
}

/**
 * GDPR erasure (right to be forgotten), DB side: revokes the user's access by
 * deleting their role assignments and records an audit event. PII held in
 * Supabase Auth is erased separately by the caller. Audit history and authored
 * records are retained — the `userId` becomes an anonymous, pseudonymous
 * reference, satisfying the 7-year audit retention requirement.
 */
export async function eraseUserRecords(
  db: PrismaClient,
  tenantId: TenantId,
  userId: UserId,
  actorId: UserId,
  ipAddress?: string | undefined,
  userAgent?: string | undefined,
): Promise<Result<void>> {
  return db
    .$transaction(async (tx) => {
      await tx.userRoleAssignment.deleteMany({ where: { tenantId, userId } });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "user.erased",
        resourceType: "user",
        resourceId: userId,
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}
