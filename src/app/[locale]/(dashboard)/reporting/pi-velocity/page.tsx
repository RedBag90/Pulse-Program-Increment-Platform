import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { TenantId } from "@/domain/types";

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

  const maxPlanned = Math.max(1, ...rows.map((r) => r.planned));

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PI Velocity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Completed vs planned story points per Program Increment
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No Program Increments yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const plannedPct = Math.round((r.planned / maxPlanned) * 100);
            const donePct = r.planned > 0 ? Math.round((r.completed / r.planned) * plannedPct) : 0;
            return (
              <div key={r.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-gray-800">{r.name}</span>
                  <span className="text-xs text-gray-500">
                    {r.completed}/{r.planned} pts
                  </span>
                </div>
                <div className="h-6 bg-gray-100 rounded-md overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500 opacity-20 rounded-md"
                    style={{ width: `${plannedPct}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-md"
                    style={{ width: `${donePct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
