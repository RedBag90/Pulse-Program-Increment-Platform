import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function PortfolioHealthPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [epicGroups, valueStreams] = await Promise.all([
    db.initiative.groupBy({
      by: ["status"],
      where: {
        tenantId: principal.tenantId as TenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
      },
      _count: { _all: true },
    }),
    db.valueStream.findMany({
      where: { tenantId: principal.tenantId as TenantId },
      select: { id: true, name: true, budgetAmount: true, budgetCurrency: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalEpics = epicGroups.reduce((sum, g) => sum + g._count._all, 0);

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio Health</h1>
        <p className="text-sm text-gray-500 mt-1">Epic progress and value-stream funding</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Epics by status ({totalEpics})</h2>
        {epicGroups.length === 0 ? (
          <p className="text-sm text-gray-400">No epics yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {epicGroups.map((g) => (
              <div key={g.status} className="rounded-lg border p-4">
                <p className="text-3xl font-bold text-gray-800">{g._count._all}</p>
                <p className="text-sm text-gray-500 mt-1">{STATUS_LABELS[g.status] ?? g.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Value streams ({valueStreams.length})</h2>
        {valueStreams.length === 0 ? (
          <p className="text-sm text-gray-400">No value streams yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {valueStreams.map((vs) => (
              <div key={vs.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{vs.name}</span>
                <span className="text-gray-500">
                  {vs.budgetAmount
                    ? `${vs.budgetAmount.toString()} ${vs.budgetCurrency ?? ""}`.trim()
                    : "No budget set"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
