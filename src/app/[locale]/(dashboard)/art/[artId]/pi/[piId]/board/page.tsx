import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string; piId: string }>;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  ready: "bg-blue-100 text-blue-700",
  "in-progress": "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default async function PiBoardPage({ params }: Props) {
  const { artId, piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [pi, teams] = await Promise.all([
    getPi(db, principal.tenantId, piId as PiId),
    db.team.findMany({
      where: { artId, tenantId: principal.tenantId as TenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!pi) notFound();

  // Deduplicate sprint indices across all teams
  const sprintIndices = [...new Set(pi.sprints.map((s) => s.indexInPi))].sort((a, b) => a - b);

  // Map: teamId → sprintIndex → sprint
  const sprintMap = new Map<string, Map<number, (typeof pi.sprints)[0]>>();
  for (const sprint of pi.sprints) {
    if (!sprintMap.has(sprint.teamId)) sprintMap.set(sprint.teamId, new Map());
    sprintMap.get(sprint.teamId)!.set(sprint.indexInPi, sprint);
  }

  const features = pi.initiatives;

  return (
    <main className="p-6 max-w-full space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi`} className="hover:underline">
          {pi.art.name}
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi/${piId}`} className="hover:underline">
          {pi.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Program Board</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Program Board — {pi.name}</h1>
        <span className="text-sm text-gray-400">
          {teams.length} team{teams.length !== 1 ? "s" : ""} · {sprintIndices.length} sprint
          {sprintIndices.length !== 1 ? "s" : ""}
        </span>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No teams in this ART yet.{" "}
          <Link href={`/art/${artId}/teams`} className="text-blue-600 hover:underline">
            Add teams
          </Link>{" "}
          to see the program board.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 border-r px-4 py-3 text-left font-semibold text-gray-700 min-w-[140px]">
                  Team
                </th>
                {sprintIndices.map((idx) => {
                  // Get dates from the first team's sprint for display
                  const anyTeamSprint = pi.sprints.find((s) => s.indexInPi === idx);
                  return (
                    <th
                      key={idx}
                      className="border-r px-3 py-3 text-center font-semibold text-gray-700 min-w-[140px]"
                    >
                      <div>Sprint {idx}</div>
                      {anyTeamSprint && (
                        <div className="text-xs font-normal text-gray-400 mt-0.5">
                          {formatDate(anyTeamSprint.startDate)} –{" "}
                          {formatDate(anyTeamSprint.endDate)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-white border-r px-4 py-4 font-medium text-gray-800">
                    {team.name}
                  </td>
                  {sprintIndices.map((idx) => {
                    const sprint = sprintMap.get(team.id)?.get(idx);
                    return (
                      <td key={idx} className="border-r px-2 py-2 align-top min-h-[80px]">
                        {sprint ? (
                          <div className="min-h-[60px] rounded-md p-1 space-y-1">
                            {/* Stories will populate this once implemented */}
                            <p className="text-[10px] text-gray-300 text-center mt-3">
                              Sprint {idx}
                            </p>
                          </div>
                        ) : (
                          <div className="min-h-[60px] flex items-center justify-center">
                            <span className="text-[10px] text-gray-200">—</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Features sidebar */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">
          Features in {pi.name} ({features.length})
        </h2>
        <p className="text-xs text-gray-400">
          Features will appear in sprint cells once stories are assigned to sprints.
        </p>
        {features.length === 0 ? (
          <p className="text-sm text-gray-400">
            No features assigned to this PI yet.{" "}
            <Link href={`/art/${artId}/features`} className="text-blue-600 hover:underline">
              Manage features
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => {
              const colorClass = STATUS_COLOR[f.status] ?? STATUS_COLOR["draft"]!;
              return (
                <Link
                  key={f.id}
                  href={`/art/${artId}/features/${f.id}`}
                  className="rounded-lg border p-3 hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700 line-clamp-2">
                      {f.title}
                    </span>
                    {f.wsjfComputed !== null && (
                      <span className="shrink-0 text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {Number(f.wsjfComputed).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}
                  >
                    {f.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
