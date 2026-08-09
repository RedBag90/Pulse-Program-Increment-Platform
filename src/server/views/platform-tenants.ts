import type { PrismaClient } from "@/generated/prisma";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { resolveUserEmails } from "@/server/services/user-directory";

/**
 * Loader für den Plattform-Tenants-Tab (cross-tenant, read-only). Läuft über den
 * `platformDb` (tenantId ""), die Filter werden EXPLIZIT gesetzt — RLS ist
 * Owner-Bypass, das App-Gating (`requirePlatformAdmin` im Layout) ist der
 * Wächter. Reine Aufbereitung; keine Mutation.
 */

export interface PlatformTenantRow {
  id: string;
  name: string;
  /** "organization" | "personal". */
  kind: string;
  /** "active" | "suspended" | "archived". */
  status: string;
  region: string;
  enabledModules: string[];
  memberCount: number;
  createdAt: string;
}

/**
 * Alle Tenants — Default nur Organisationen (Personal-Tenants sind der private
 * Free-Bereich jedes Users und blähen die Liste auf). `includePersonal` schaltet
 * sie zu.
 */
export async function listAllTenants(
  db: PrismaClient,
  opts: { includePersonal?: boolean } = {},
): Promise<PlatformTenantRow[]> {
  const rows = await db.tenant.findMany({
    where: opts.includePersonal ? {} : { kind: "organization" },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      region: true,
      enabledModules: true,
      createdAt: true,
      _count: { select: { userRoleAssignments: true } },
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    status: t.status,
    region: t.region,
    enabledModules: t.enabledModules,
    memberCount: t._count.userRoleAssignments,
    createdAt: t.createdAt.toISOString().slice(0, 10),
  }));
}

export interface PlatformTenantMember {
  assignmentId: string;
  userId: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

export interface PlatformTenantDetail {
  id: string;
  name: string;
  kind: string;
  status: string;
  region: string;
  enabledModules: string[];
  createdAt: string;
  members: PlatformTenantMember[];
}

/** Detail eines Tenants inkl. Mitglieder (E-Mails aus Supabase Auth aufgelöst). */
export async function loadTenantDetail(
  db: PrismaClient,
  tenantId: string,
): Promise<PlatformTenantDetail | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      region: true,
      enabledModules: true,
      createdAt: true,
      userRoleAssignments: {
        select: { id: true, userId: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!tenant) return null;

  const emails = await resolveUserEmails(tenant.userRoleAssignments.map((a) => a.userId));
  return {
    id: tenant.id,
    name: tenant.name,
    kind: tenant.kind,
    status: tenant.status,
    region: tenant.region,
    enabledModules: tenant.enabledModules,
    createdAt: tenant.createdAt.toISOString().slice(0, 10),
    members: tenant.userRoleAssignments.map((a) => ({
      assignmentId: a.id,
      userId: a.userId,
      email: emails[a.userId] ?? null,
      role: a.role as Role,
      createdAt: a.createdAt.toISOString().slice(0, 10),
    })),
  };
}
