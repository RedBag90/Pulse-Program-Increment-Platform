import { createQueryHandler } from "@/server/http/query-handler";

/** Tenant users with their role assignments. Tenant Admin only. */
export const GET = createQueryHandler({
  readAction: "admin.users.read",
  resource: (_params, principal) => ({ tenantId: principal.tenantId }),
  query: async (ctx) => {
    const assignments = await ctx.db.userRoleAssignment.findMany({
      where: { tenantId: ctx.principal.tenantId },
      orderBy: { createdAt: "asc" },
    });

    // Group assignments by user.
    const byUser = new Map<string, typeof assignments>();
    for (const a of assignments) {
      if (!byUser.has(a.userId)) byUser.set(a.userId, []);
      byUser.get(a.userId)!.push(a);
    }

    return [...byUser.entries()].map(([userId, roles]) => ({
      userId,
      roles: roles.map((r) => ({
        assignmentId: r.id,
        role: r.role,
        valueStreamIds: r.valueStreamIds,
        artIds: r.artIds,
        teamIds: r.teamIds,
      })),
    }));
  },
});
