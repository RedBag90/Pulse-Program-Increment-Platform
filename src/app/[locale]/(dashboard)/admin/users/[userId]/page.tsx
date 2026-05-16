import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listUserRoles } from "@/server/services/role-assignment";
import { AddRoleForm } from "@/features/admin/components/add-role-form";
import { RemoveRoleButton } from "@/features/admin/components/remove-role-button";
import { redirect } from "next/navigation";
import type { TenantId, UserId } from "@/domain/types";

interface Props {
  params: Promise<{ locale: string; userId: string }>;
}

export default async function UserDetailPage({ params }: Props) {
  const { userId } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) redirect("/portfolio");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [assignments, valueStreams] = await Promise.all([
    listUserRoles(db, principal.tenantId as TenantId, userId as UserId),
    db.valueStream.findMany({
      where: { tenantId: principal.tenantId },
      include: { arts: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-10">
      <div>
        <a href="../users" className="text-sm text-blue-600 hover:underline">
          ← Back to users
        </a>
        <h1 className="text-2xl font-semibold mt-2">User Detail</h1>
        <p className="text-sm text-gray-500 font-mono mt-1">{userId}</p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Current Role Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-gray-500 text-sm">No roles assigned yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Value Streams</th>
                <th className="pb-2 pr-4">ARTs</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b align-top">
                  <td className="py-2 pr-4 font-medium">{a.role}</td>
                  <td className="py-2 pr-4 text-gray-600 text-xs">
                    {a.valueStreamIds.length === 0 ? "All" : a.valueStreamIds.join(", ")}
                  </td>
                  <td className="py-2 pr-4 text-gray-600 text-xs">
                    {a.artIds.length === 0 ? "All" : a.artIds.join(", ")}
                  </td>
                  <td className="py-2">
                    <RemoveRoleButton assignmentId={a.id} targetUserId={userId} role={a.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Assign New Role</h2>
        <AddRoleForm
          targetUserId={userId}
          valueStreams={valueStreams.map((vs) => ({
            id: vs.id,
            name: vs.name,
            arts: vs.arts.map((a) => ({ id: a.id, name: a.name })),
          }))}
        />
      </section>
    </main>
  );
}
