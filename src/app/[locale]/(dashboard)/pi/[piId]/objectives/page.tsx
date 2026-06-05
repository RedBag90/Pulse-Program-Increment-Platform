import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { CreatePiObjectiveDialog } from "@/features/pi/components/create-pi-objective-dialog";
import { ObjectiveConfidenceVote } from "@/features/pi/components/objective-confidence-vote";
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
  const timeline = pi.timeline;
  if (!timeline) notFound();

  const artIds = timeline.arts.map((a) => a.id);

  const [objectives, teams] = await Promise.all([
    listPiObjectives(db, principal.tenantId as TenantId, piId as PiId),
    db.team.findMany({
      where: { artId: { in: artIds }, tenantId: principal.tenantId as TenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  // Team → ART map so the dialog/ConfidenceVote dispatch with the right ART,
  // even though a PI now spans many ARTs.
  const teamArtId = new Map(teams.map((t) => [t.id, t.artId]));

  const canVote = hasCapability(principal, "pi_objective.update", {
    tenantId: principal.tenantId,
    ...(timeline.arts[0] ? { artId: timeline.arts[0].id } : {}),
  });

  // Group objectives by team
  const byTeam = new Map<string, { teamName: string; objectives: typeof objectives }>();
  for (const obj of objectives) {
    const key = obj.teamId;
    if (!byTeam.has(key)) byTeam.set(key, { teamName: obj.team.name, objectives: [] });
    byTeam.get(key)!.objectives.push(obj);
  }

  return (
    <main className="p-8 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Struktur", href: "/structure" },
          { label: `Timeline: ${timeline.name}`, href: "/structure?tab=timeline" },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Objectives" },
        ]}
      />

      <PiSubNav piId={piId} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">PI Objectives — {pi.name}</h1>
        <CreatePiObjectiveDialog piId={piId} teams={teams} />
      </div>

      {objectives.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground/60">
          No objectives yet. Add objectives for each team to capture what the ART commits to this
          PI.
        </div>
      ) : (
        <div className="space-y-6">
          {[...byTeam.entries()].map(([teamId, { teamName, objectives: teamObjs }]) => (
            <section key={teamId} className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                {teamName}
                <span className="text-xs font-normal text-muted-foreground/60">
                  {teamObjs.length} objective{teamObjs.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="rounded-lg border divide-y">
                {teamObjs.map((obj) => (
                  <div key={obj.id} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{obj.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            obj.committed
                              ? "bg-green-100 text-green-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {obj.committed ? "Committed" : "Uncommitted"}
                        </span>
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground">{obj.description}</p>
                      )}
                      <div className="pt-1">
                        <ObjectiveConfidenceVote
                          objectiveId={obj.id}
                          artId={teamArtId.get(obj.teamId) ?? ""}
                          current={obj.confidence}
                          canVote={canVote}
                        />
                      </div>
                    </div>
                    {obj.businessValue !== null && (
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-foreground">{obj.businessValue}</div>
                        <div className="text-[10px] text-muted-foreground/60">BV</div>
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
