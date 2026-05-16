import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { redirect, notFound } from "next/navigation";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export default async function VelocityPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const art = await db.art.findFirst({
    where: { id: artId, tenantId: principal.tenantId as TenantId },
  });
  if (!art) notFound();

  const pis = await db.programIncrement.findMany({
    where: { artId, tenantId: principal.tenantId as TenantId },
    orderBy: { startDate: "asc" },
    include: {
      sprints: {
        include: {
          team: { select: { id: true, name: true } },
          initiatives: {
            where: { level: InitiativeLevel.STORY, deletedAt: null },
            select: { id: true, status: true, storyPoints: true },
          },
        },
      },
    },
  });

  // Build velocity data: per PI, per team — completed story points
  const teams = new Map<string, string>(); // teamId → name
  for (const pi of pis) {
    for (const sprint of pi.sprints) {
      teams.set(sprint.team.id, sprint.team.name);
    }
  }

  const teamList = [...teams.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  // velocityData[piId][teamId] = { planned, completed }
  const velocityData = pis.map((pi) => {
    const byTeam = new Map<string, { planned: number; completed: number }>();
    for (const sprint of pi.sprints) {
      const tid = sprint.team.id;
      if (!byTeam.has(tid)) byTeam.set(tid, { planned: 0, completed: 0 });
      const entry = byTeam.get(tid)!;
      for (const story of sprint.initiatives) {
        const pts = story.storyPoints ?? 0;
        entry.planned += pts;
        if (story.status === "completed") entry.completed += pts;
      }
    }
    return { pi, byTeam };
  });

  // Max points across all teams/PIs for scaling bars
  const maxPoints = Math.max(
    1,
    ...velocityData.flatMap(({ byTeam }) => [...byTeam.values()].map((v) => v.planned)),
  );

  const TEAM_COLORS = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-teal-500",
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <ArtSubNav artId={artId} artName={art.name} />

      <div>
        <h1 className="text-xl font-semibold">PI Velocity</h1>
        <p className="text-sm text-gray-500 mt-1">Completed story points per team per PI</p>
      </div>

      {pis.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No Program Increments yet. Create a PI to start tracking velocity.
        </div>
      ) : teamList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No teams in this ART. Add teams to track per-team velocity.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Legend */}
          <div className="flex gap-4 flex-wrap text-xs">
            {teamList.map(([tid, name], i) => (
              <div key={tid} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${TEAM_COLORS[i % TEAM_COLORS.length]}`} />
                <span className="text-gray-600">{name}</span>
              </div>
            ))}
          </div>

          {/* Bar chart per PI */}
          <div className="space-y-6">
            {velocityData.map(({ pi, byTeam }) => {
              const totalPlanned = [...byTeam.values()].reduce((s, v) => s + v.planned, 0);
              const totalDone = [...byTeam.values()].reduce((s, v) => s + v.completed, 0);
              return (
                <div key={pi.id} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-medium text-gray-800">{pi.name}</h3>
                    <span className="text-xs text-gray-400">
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                      {" · "}
                      <span className="font-medium text-gray-600">
                        {totalDone}/{totalPlanned} pts
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {teamList.map(([tid, name], i) => {
                      const data = byTeam.get(tid) ?? { planned: 0, completed: 0 };
                      const plannedPct = Math.round((data.planned / maxPoints) * 100);
                      const donePct =
                        data.planned > 0
                          ? Math.round((data.completed / data.planned) * plannedPct)
                          : 0;
                      const colorClass = TEAM_COLORS[i % TEAM_COLORS.length]!;
                      return (
                        <div key={tid} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-28 truncate shrink-0">
                            {name}
                          </span>
                          <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                            {/* planned bar (lighter) */}
                            <div
                              className={`absolute inset-y-0 left-0 ${colorClass} opacity-20 rounded-md`}
                              style={{ width: `${plannedPct}%` }}
                            />
                            {/* completed bar (solid) */}
                            <div
                              className={`absolute inset-y-0 left-0 ${colorClass} rounded-md`}
                              style={{ width: `${donePct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-20 text-right shrink-0">
                            {data.completed}/{data.planned} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
