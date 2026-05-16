import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpics } from "@/server/services/initiative";
import { KanbanBoard } from "@/features/portfolio/components/kanban-board";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const STATUS_GROUPS = [
  "draft",
  "in_review",
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

export default async function PortfolioPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [epics, allInitiatives] = await Promise.all([
    listEpics(db, principal.tenantId),
    db.initiative.findMany({
      where: { tenantId: principal.tenantId as TenantId, deletedAt: null },
      select: { id: true, level: true, status: true, updatedAt: true },
    }),
  ]);

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  // Health metrics
  const epicsByStatus: Record<string, number> = {};
  for (const e of epics) {
    epicsByStatus[e.status] = (epicsByStatus[e.status] ?? 0) + 1;
  }

  const staleEpics = epics.filter(
    (e) =>
      Date.now() - new Date(e.updatedAt).getTime() > THIRTY_DAYS_MS &&
      e.status !== "completed" &&
      e.status !== "cancelled",
  );

  const features = allInitiatives.filter((i) => i.level === InitiativeLevel.FEATURE);
  const stories = allInitiatives.filter((i) => i.level === InitiativeLevel.STORY);
  const tasks = allInitiatives.filter((i) => i.level === InitiativeLevel.TASK);

  return (
    <main className="p-8 space-y-8 max-w-7xl mx-auto">
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

      {/* Health summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Epics</p>
          <p className="text-3xl font-bold text-gray-800">{epics.length}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Features</p>
          <p className="text-3xl font-bold text-gray-800">{features.length}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Stories</p>
          <p className="text-3xl font-bold text-gray-800">{stories.length}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Tasks</p>
          <p className="text-3xl font-bold text-gray-800">{tasks.length}</p>
        </div>
      </section>

      {/* Epic status breakdown */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Epics by Status</h2>
        <div className="flex gap-2 flex-wrap">
          {STATUS_GROUPS.map((s) => {
            const count = epicsByStatus[s] ?? 0;
            if (count === 0) return null;
            return (
              <Link
                key={s}
                href={`/portfolio/epics?status=${s}`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:border-blue-300 transition-colors"
              >
                <span className="text-xl font-bold text-gray-800">{count}</span>
                <span className="text-xs text-gray-500 capitalize">{s.replace("_", " ")}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stale epics */}
      {staleEpics.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            Stale Epics
            <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {staleEpics.length} no activity &gt;30 days
            </span>
          </h2>
          <div className="rounded-lg border divide-y">
            {staleEpics.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <Link
                  href={`/portfolio/epics/${e.id}`}
                  className="text-blue-700 hover:underline font-medium"
                >
                  {e.title}
                </Link>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{e.valueStream?.name ?? "—"}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">{e.status}</span>
                  <span className="text-amber-600">
                    {Math.floor(
                      (Date.now() - new Date(e.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
                    )}
                    d ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Kanban board */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Epic Stage Gates</h2>
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
      </section>
    </main>
  );
}
