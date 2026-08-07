import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Projekt-weite User→E-Mail-Map (der teure Supabase-`listUsers`-Call). Nicht
 * tenant-abhängig — `listUsers` liefert alle Nutzer des Supabase-Projekts, die
 * dann pro Tenant gefiltert werden. Deshalb einmal global gecacht:
 *  - React `cache` → Dedup innerhalb eines Requests;
 *  - `unstable_cache` (60 s) → Wiederverwendung über Requests/Tenants hinweg.
 * Anzeigenamen ändern sich selten; ≤ 60 s Verzögerung ist akzeptabel. Bei
 * Fehler/fehlender Service-Role → leere Map (Aufrufer fallen auf die Roh-Id zurück).
 */
const listAllUserEmails = cache(
  unstable_cache(
    async (): Promise<Record<string, string>> => {
      try {
        const admin = createAdminClient();
        // A project's user count is small; one large page avoids pagination.
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (error) return {};
        const map: Record<string, string> = {};
        for (const u of data.users) if (u.email) map[u.id] = u.email;
        return map;
      } catch {
        return {};
      }
    },
    ["all-user-emails"],
    { revalidate: 60 },
  ),
);

/**
 * Maps the tenant's user ids to a human label (their email). The per-tenant
 * role-assignment query stays fresh (tenant-scoped); the expensive Supabase user
 * list comes from {@link listAllUserEmails} (cached). On any failure it returns an
 * empty map, and callers fall back to the raw id via {@link userLabel}. Read-only.
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

  const all = await listAllUserEmails();
  const labels: Record<string, string> = {};
  for (const id of ids) {
    const email = all[id];
    if (email) labels[id] = email;
  }
  return labels;
}
