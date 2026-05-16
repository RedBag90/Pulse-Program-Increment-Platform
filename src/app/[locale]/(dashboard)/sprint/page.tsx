import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { TenantId } from "@/domain/types";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MySprintsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const { teamIds } = principal.scopes;

  const sprints = await db.sprint.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      ...(teamIds.length > 0 ? { teamId: { in: teamIds } } : {}),
    },
    include: {
      team: { select: { name: true } },
      pi: { select: { id: true, name: true } },
    },
    orderBy: [{ startDate: "desc" }],
  });

  const byPi = new Map<string, { piName: string; sprints: typeof sprints }>();
  for (const sprint of sprints) {
    if (!byPi.has(sprint.pi.id)) byPi.set(sprint.pi.id, { piName: sprint.pi.name, sprints: [] });
    byPi.get(sprint.pi.id)!.sprints.push(sprint);
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Sprints</h1>
        <p className="text-sm text-gray-500 mt-1">
          {teamIds.length > 0 ? "Sprints for the teams you belong to" : "Sprints across all teams"}
        </p>
      </div>

      {sprints.length === 0 ? (
        <p className="text-gray-500 text-sm">No sprints yet.</p>
      ) : (
        <div className="space-y-6">
          {[...byPi.entries()].map(([piId, { piName, sprints: piSprints }]) => (
            <section key={piId} className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {piName}
              </h2>
              <div className="rounded-lg border divide-y">
                {piSprints.map((sprint) => (
                  <Link
                    key={sprint.id}
                    href={`/sprint/${sprint.id}`}
                    className="px-4 py-3 flex items-center justify-between text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-blue-700">
                      {sprint.team.name} — Sprint {sprint.indexInPi}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                    </span>
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
