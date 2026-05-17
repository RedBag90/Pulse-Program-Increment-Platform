import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";

// ---------------------------------------------------------------------------
// Cross-level Initiative reads — shared by Epics, Features, Stories and Tasks.
// Level-specific operations live in epic.ts / feature.ts / story.ts / task.ts.
// ---------------------------------------------------------------------------

/**
 * Audit history for a single initiative, newest first — backs the Activity
 * sidebar and the History tab. Index-served by `[resourceType, resourceId,
 * occurredAt]` on `AuditEvent`.
 */
export async function listInitiativeHistory(
  db: PrismaClient,
  tenantId: TenantId,
  initiativeId: string,
  limit = 50,
) {
  return db.auditEvent.findMany({
    where: { tenantId, resourceType: "initiative", resourceId: initiativeId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

/**
 * Title search across all initiative levels — backs the dependency picker's
 * typeahead. Tenant-scoped; soft-deleted rows excluded.
 */
export async function searchInitiatives(
  db: PrismaClient,
  tenantId: TenantId,
  query: string,
  limit = 20,
) {
  const q = query.trim();
  return db.initiative.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(q !== "" && { title: { contains: q, mode: "insensitive" } }),
    },
    select: { id: true, title: true, level: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
