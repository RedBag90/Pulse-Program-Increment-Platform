import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VelocityTrendChart } from "@/components/charts/velocity-trend-chart";
import { Activity } from "lucide-react";

export default async function PiVelocityPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pis = await db.programIncrement.findMany({
    where: { tenantId: principal.tenantId as TenantId },
    select: { id: true, name: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  const stories = await db.initiative.groupBy({
    by: ["piId", "status"],
    where: {
      tenantId: principal.tenantId as TenantId,
      level: InitiativeLevel.STORY,
      deletedAt: null,
      piId: { in: pis.map((p) => p.id) },
    },
    _sum: { storyPoints: true },
  });

  const rows = pis.map((pi) => {
    const piStories = stories.filter((s) => s.piId === pi.id);
    const planned = piStories.reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
    const completed = piStories
      .filter((r) => r.status === "completed" || r.status === "done")
      .reduce((sum, r) => sum + (r._sum.storyPoints ?? 0), 0);
    return { id: pi.id, name: pi.name, planned, completed };
  });

  return (
    <main className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">PI Velocity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Completed vs planned story points per Program Increment
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            Velocity Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No Program Increments yet.
            </p>
          ) : (
            <>
              <VelocityTrendChart data={rows} />
              <div className="mt-4 space-y-3">
                {rows.map((r) => {
                  const maxPlanned = Math.max(1, ...rows.map((x) => x.planned));
                  const plannedPct = Math.round((r.planned / maxPlanned) * 100);
                  const donePct =
                    r.planned > 0 ? Math.round((r.completed / r.planned) * plannedPct) : 0;
                  return (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r.completed}/{r.planned} pts
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full"
                          style={{ width: `${plannedPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                          style={{ width: `${donePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
