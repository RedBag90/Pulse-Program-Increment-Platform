import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { CreatePiObjectiveDialog } from "@/features/pi/components/create-pi-objective-dialog";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";

interface Props {
  params: Promise<{ piId: string }>;
}

export default async function PiObjectivesPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();

  const [objectives, teams] = await Promise.all([
    listPiObjectives(db, principal.tenantId as TenantId, piId as PiId),
    db.team.findMany({
      where: { artId: pi.art.id, tenantId: principal.tenantId as TenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  // Group objectives by team
  const byTeam = new Map<string, { teamName: string; objectives: typeof objectives }>();
  for (const obj of objectives) {
    const key = obj.teamId;
    if (!byTeam.has(key)) byTeam.set(key, { teamName: obj.team.name, objectives: [] });
    byTeam.get(key)!.objectives.push(obj);
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: pi.art.name, href: `/art/${pi.art.id}` },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Objectives" },
        ]}
      />

      <PiSubNav piId={piId} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">PI Objectives — {pi.name}</h1>
        <CreatePiObjectiveDialog piId={piId} artId={pi.art.id} teams={teams} />
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
