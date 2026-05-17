import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";

/**
 * Audit history for a single resource, newest first — backs the Verlauf tab of
 * the Capacity-Planning detail pages. Generic over `resourceType`
 * (`value_stream` / `art` / `team`); index-served by the
 * `[resourceType, resourceId, occurredAt]` index on `AuditEvent`.
 */
export async function listAuditHistory(
  db: PrismaClient,
  tenantId: TenantId,
  resourceType: string,
  resourceId: string,
  limit = 50,
) {
  return db.auditEvent.findMany({
    where: { tenantId, resourceType, resourceId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
