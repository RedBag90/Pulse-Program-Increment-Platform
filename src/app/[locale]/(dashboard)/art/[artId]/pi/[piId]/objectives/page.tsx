import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { CreatePiObjectiveDialog } from "@/features/pi/components/create-pi-objective-dialog";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string; piId: string }>;
}

export default async function PiObjectivesPage({ params }: Props) {
  const { artId, piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [pi, objectives, teams] = await Promise.all([
    getPi(db, principal.tenantId, piId as PiId),
    listPiObjectives(db, principal.tenantId as TenantId, piId as PiId),
    db.team.findMany({
      where: { artId, tenantId: principal.tenantId as TenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!pi) notFound();

  // Group objectives by team
  const byTeam = new Map<string, { teamName: string; objectives: typeof objectives }>();
  for (const obj of objectives) {
    const key = obj.teamId;
    if (!byTeam.has(key)) byTeam.set(key, { teamName: obj.team.name, objectives: [] });
    byTeam.get(key)!.objectives.push(obj);
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
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
        <span className="text-gray-800 font-medium">Objectives</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">PI Objectives — {pi.name}</h1>
        <CreatePiObjectiveDialog piId={piId} artId={artId} teams={teams} />
      </div>

      {objectives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-gray-400">
          No objectives yet. Add objectives for each team to capture what the ART commits to this
          PI.
        </div>
      ) : (
        <div className="space-y-6">
          {[...byTeam.entries()].map(([teamId, { teamName, objectives: teamObjs }]) => (
            <section key={teamId} className="space-y-3">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                {teamName}
                <span className="text-xs font-normal text-gray-400">
                  {teamObjs.length} objective{teamObjs.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="rounded-lg border divide-y">
                {teamObjs.map((obj) => (
                  <div key={obj.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{obj.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            obj.committed
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {obj.committed ? "Committed" : "Uncommitted"}
                        </span>
                      </div>
                      {obj.description && (
                        <p className="text-xs text-gray-500">{obj.description}</p>
                      )}
                    </div>
                    {obj.businessValue !== null && (
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-gray-800">{obj.businessValue}</div>
                        <div className="text-[10px] text-gray-400">BV</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
