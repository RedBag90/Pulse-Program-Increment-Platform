import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WsjfBarChart } from "@/components/charts/wsjf-bar-chart";
import { Trophy } from "lucide-react";

export default async function WsjfLeaderboardPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const features = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      wsjfComputed: true,
      art: { select: { name: true } },
      pi: { select: { name: true } },
    },
    orderBy: { wsjfComputed: { sort: "desc", nulls: "last" } },
  });

  const topFeatures = features.filter((f) => f.wsjfComputed !== null).slice(0, 15);

  const chartData = topFeatures.map((f) => ({
    title: f.title,
    score: Number(f.wsjfComputed),
  }));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WSJF Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All features ranked by computed WSJF score
        </p>
      </div>

      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">No features yet.</p>
      ) : (
        <>
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="size-4 text-muted-foreground" />
                  Top {Math.min(15, chartData.length)} by WSJF Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WsjfBarChart data={chartData} />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-10">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Feature
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">
                    ART
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">
                    PI
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground w-20">
                    WSJF
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {features.map((f, i) => (
                  <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/feature/${f.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {f.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">
                      {f.art?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">
                      {f.pi?.name ?? "Backlog"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {f.wsjfComputed !== null ? Number(f.wsjfComputed).toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </main>
  );
}
