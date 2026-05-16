import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/initiative";
import { KanbanBoard } from "@/features/portfolio/components/kanban-board";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

export default async function PortfolioPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await listEpics(db, principal.tenantId);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <nav className="flex gap-4 text-sm text-blue-700">
          <Link href="/portfolio/epics" className="hover:underline">
            All Epics
          </Link>
          <Link href="/portfolio/value-streams" className="hover:underline">
            Value Streams
          </Link>
        </nav>
      </div>

      <KanbanBoard
        epics={epics.map((e) => ({
          id: e.id,
          title: e.title,
          stageGate: e.stageGate,
          status: e.status,
          valueStream: e.valueStream,
        }))}
        canEdit={canEdit}
        tenantId={principal.tenantId}
      />
    </main>
  );
}
