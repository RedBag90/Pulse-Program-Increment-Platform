import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { InviteUserForm } from "@/features/admin/components/invite-user-form";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) redirect("/portfolio");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const assignments = await db.userRoleAssignment.findMany({
    where: { tenantId: principal.tenantId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold">User Management</h1>

      <section>
        <h2 className="text-lg font-medium mb-4">Current Members</h2>
        {assignments.length === 0 ? (
          <p className="text-gray-500 text-sm">No members yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">User ID</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2">Since</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{a.userId}</td>
                  <td className="py-2 pr-4">{a.role}</td>
                  <td className="py-2 text-gray-500">{a.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Invite a New User</h2>
        <InviteUserForm />
      </section>
    </main>
  );
}
