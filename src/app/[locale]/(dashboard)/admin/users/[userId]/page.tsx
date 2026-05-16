import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listUserRoles } from "@/server/services/role-assignment";
import { AddRoleForm } from "@/features/admin/components/add-role-form";
import { RemoveRoleButton } from "@/features/admin/components/remove-role-button";
import { EraseUserButton } from "@/features/admin/components/erase-user-button";
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
        <a href="../users" className="text-sm text-primary hover:underline">
          ← Back to users
        </a>
        <h1 className="text-2xl font-semibold mt-2">User Detail</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">{userId}</p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Current Role Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No roles assigned yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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
                  <td className="py-2 pr-4 text-muted-foreground text-xs">
                    {a.valueStreamIds.length === 0 ? "All" : a.valueStreamIds.join(", ")}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground text-xs">
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

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-medium">Data &amp; Privacy (GDPR)</h2>
        <p className="text-sm text-muted-foreground">
          Export everything Pulse holds about this user, or erase their account.
        </p>
        <div className="flex items-center gap-4">
          <a
            href={`/api/v1/admin/users/${userId}/export`}
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-muted/50"
          >
            Export user data (JSON)
          </a>
          <EraseUserButton userId={userId} />
        </div>
      </section>
    </main>
  );
}
