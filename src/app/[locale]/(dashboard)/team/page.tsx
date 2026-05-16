import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";

export default async function TeamsIndexPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const teams = await db.team.findMany({
    where: { tenantId: principal.tenantId as TenantId },
    include: {
      art: { select: { id: true, name: true } },
      _count: { select: { sprints: true } },
    },
    orderBy: { name: "asc" },
  });

  const byArt = new Map<string, { artName: string; teams: typeof teams }>();
  for (const team of teams) {
    if (!byArt.has(team.art.id)) byArt.set(team.art.id, { artName: team.art.name, teams: [] });
    byArt.get(team.art.id)!.teams.push(team);
  }

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All teams across your Agile Release Trains
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teams yet.</p>
      ) : (
        <div className="space-y-6">
          {[...byArt.entries()].map(([artId, { artName, teams: artTeams }]) => (
            <section key={artId} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {artName}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {artTeams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/team/${team.id}`}
                    className="border rounded-lg p-5 space-y-1 hover:border-blue-300 hover:shadow-sm transition-colors"
                  >
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-xs text-muted-foreground/60">
                      {team._count.sprints} sprint{team._count.sprints !== 1 ? "s" : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
