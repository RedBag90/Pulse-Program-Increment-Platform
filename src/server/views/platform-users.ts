import type { PrismaClient } from "@/generated/prisma";
import type { Role } from "@/domain/roles";
import { ROLES } from "@/domain/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Loader für den Plattform-Nutzer-Tab (globales Verzeichnis). Merged die
 * Supabase-Auth-User (E-Mail, letzte Aktivität, Ban-Status, angelegt) mit den
 * tenant-blinden Role-Assignments aus Prisma. Personal-Tenant-Rollen sind
 * ausgeblendet (jeder ist tenant_admin seines Free-Bereichs — kein Signal);
 * die globale `platform_admin`-Rolle wird als eigenes Flag geführt.
 */

export interface PlatformUserRow {
  id: string;
  email: string | null;
  /** Org-Rollen (Personal-Tenant-Rollen ausgeblendet), dedupliziert. */
  roles: Role[];
  isPlatformAdmin: boolean;
  /** "active" | "suspended" (Supabase-Ban). */
  status: "active" | "suspended";
  /** ISO-Tag der letzten Anmeldung, oder null. */
  lastSignInAt: string | null;
  /** ISO-Tag der Kontoerstellung, oder null. */
  createdAt: string | null;
}

const isoDay = (v: string | null | undefined): string | null =>
  v ? new Date(v).toISOString().slice(0, 10) : null;

function isBanned(bannedUntil: string | null | undefined): boolean {
  return bannedUntil != null && new Date(bannedUntil).getTime() > Date.now();
}

export async function listAllUsers(db: PrismaClient): Promise<PlatformUserRow[]> {
  // 1) Tenant-blinde Assignments inkl. Tenant-Art (für Personal-Ausblendung).
  const assignments = await db.userRoleAssignment.findMany({
    select: { userId: true, role: true, tenant: { select: { kind: true } } },
  });
  const byUser = new Map<string, { orgRoles: Set<Role>; platformAdmin: boolean }>();
  for (const a of assignments) {
    const entry = byUser.get(a.userId) ?? { orgRoles: new Set<Role>(), platformAdmin: false };
    if (a.role === ROLES.PLATFORM_ADMIN) entry.platformAdmin = true;
    else if (a.tenant.kind === "organization") entry.orgRoles.add(a.role as Role);
    byUser.set(a.userId, entry);
  }

  // 2) Supabase-Auth-User (paginiert).
  const admin = createAdminClient();
  const authUsers: Array<{
    id: string;
    email?: string;
    created_at?: string;
    last_sign_in_at?: string | null;
    banned_until?: string | null;
  }> = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    authUsers.push(...data.users);
    if (data.users.length < 200) break;
  }

  // 3) Merge — Reihenfolge nach E-Mail.
  return authUsers
    .map((u) => {
      const entry = byUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        roles: entry ? [...entry.orgRoles] : [],
        isPlatformAdmin: entry?.platformAdmin ?? false,
        status: isBanned(u.banned_until) ? ("suspended" as const) : ("active" as const),
        lastSignInAt: isoDay(u.last_sign_in_at),
        createdAt: isoDay(u.created_at),
      } satisfies PlatformUserRow;
    })
    .sort((a, b) => (a.email ?? a.id).localeCompare(b.email ?? b.id, "de"));
}
