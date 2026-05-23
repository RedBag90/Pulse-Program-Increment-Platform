import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Maps the tenant's user ids to a human label (their email). Backed by the
 * Supabase admin API and scoped to users that hold a role in this tenant. On
 * any failure (e.g. the service-role env is not configured in a given
 * environment) it returns an empty map, and callers fall back to the raw id via
 * {@link userLabel}. Read-only — never throws.
 */
export async function listTenantUserLabels(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Record<string, string>> {
  const assignments = await db.userRoleAssignment.findMany({
    where: { tenantId },
    select: { userId: true },
  });
  const ids = new Set(assignments.map((a) => a.userId));
  if (ids.size === 0) return {};

  const labels: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    // A tenant's user count is small; one large page avoids pagination.
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return {};
    for (const u of data.users) {
      if (ids.has(u.id) && u.email) labels[u.id] = u.email;
    }
  } catch {
    return {};
  }
  return labels;
}
