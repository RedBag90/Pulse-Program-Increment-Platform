import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDistributionChart } from "@/components/charts/status-distribution-chart";
import { getValueStreamBudgets } from "@/server/services/budgeting";
import { BarChart2, GitBranch } from "lucide-react";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number) => eur.format(Math.round(v));

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

  const [epicGroups, valueStreams, vsBudgets] = await Promise.all([
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
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getValueStreamBudgets(db, principal.tenantId),
  ]);

  // Derived allocated budget per Value Stream (participatory budgeting).
  const budgetTotals: Record<string, number> = Object.fromEntries(
    vsBudgets.valueStreams.map((b) => [b.valueStreamId, b.total]),
  );

  const totalEpics = epicGroups.reduce((sum, g) => sum + g._count._all, 0);

  const chartData = epicGroups.map((g) => ({
    status: STATUS_LABELS[g.status] ?? g.status,
    count: g._count._all,
  }));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio Health</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Epic progress and value-stream funding
        </p>
      </div>

      {/* Epic distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="size-4 text-muted-foreground" />
            Epics by Status
            <span className="ml-1 text-muted-foreground font-normal">({totalEpics})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {epicGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No epics yet.</p>
          ) : (
            <>
              <StatusDistributionChart data={chartData} />
              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {epicGroups.map((g) => (
                  <div key={g.status} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-2xl font-bold tabular-nums">{g._count._all}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {STATUS_LABELS[g.status] ?? g.status}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Value Streams */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            Value Streams
            <span className="ml-1 text-muted-foreground font-normal">({valueStreams.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {valueStreams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No value streams yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {valueStreams.map((vs) => (
                <div key={vs.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <span className="font-medium">{vs.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {budgetTotals[vs.id] ? fmtEur(budgetTotals[vs.id]!) : "No budget set"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
