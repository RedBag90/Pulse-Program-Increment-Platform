import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { ROLES } from "@/domain/roles";

/** Tenant users with their role assignments. Tenant Admin only. */
export async function GET(): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const isAdmin =
    principal.roles.includes(ROLES.TENANT_ADMIN) || principal.roles.includes(ROLES.PLATFORM_ADMIN);
  if (!isAdmin) return problemJson(403, "forbidden");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const assignments = await db.userRoleAssignment.findMany({
    where: { tenantId: principal.tenantId },
    orderBy: { createdAt: "asc" },
  });

  // Group assignments by user.
  const byUser = new Map<string, typeof assignments>();
  for (const a of assignments) {
    if (!byUser.has(a.userId)) byUser.set(a.userId, []);
    byUser.get(a.userId)!.push(a);
  }

  const users = [...byUser.entries()].map(([userId, roles]) => ({
    userId,
    roles: roles.map((r) => ({
      assignmentId: r.id,
      role: r.role,
      valueStreamIds: r.valueStreamIds,
      artIds: r.artIds,
      teamIds: r.teamIds,
    })),
  }));

  return Response.json(users);
}
