import { Network, Zap, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { userLabel } from "@/components/detail/initiative-labels";
import { teamTypeLabel } from "@/domain/team-type";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { CreateTeamDialog } from "@/features/team/components/create-team-dialog";
import type { StructureTree as Tree } from "@/server/services/structure";

interface Props {
  tree: Tree;
  userLabels: Record<string, string>;
  canCreateVs: boolean;
  canCreateArt: boolean;
  canCreateTeam: boolean;
}

function person(id: string | null, labels: Record<string, string>): string | null {
  return id ? userLabel(id, labels) : null;
}

/**
 * Expandable VS → ART → Team tree for the Structure hub. Native `<details>`
 * (no client JS); the existing create dialogs are embedded per node. Each node
 * links to its detail page.
 */
export function StructureTree({
  tree,
  userLabels,
  canCreateVs,
  canCreateArt,
  canCreateTeam,
}: Props) {
  return (
    <div className="space-y-3">
      {canCreateVs && (
        <div className="flex justify-end">
          <CreateValueStreamDialog />
        </div>
      )}
      {tree.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Noch keine Wertströme. Lege einen an, um die Struktur aufzubauen.
        </p>
      ) : (
        tree.map((vs) => {
          const vmo = person(vs.vmoId, userLabels);
          const finance = person(vs.financeApproverId, userLabels);
          return (
            <details key={vs.id} open className="rounded-lg border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                <Network className="h-4 w-4 shrink-0 text-primary" />
                <Link
                  href={`/capacity/value-streams/${vs.id}`}
                  className="font-medium hover:underline"
                >
                  {vs.name}
                </Link>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {vs.arts.length} ART{vs.arts.length !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {vs.budgetAmount
                    ? `${vs.budgetAmount.toString()} ${vs.budgetCurrency ?? ""}`
                    : ""}
                </span>
              </summary>

              <div className="space-y-2 border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  VMO: <span className="text-foreground">{vmo ?? "—"}</span> · Finance:{" "}
                  <span className="text-foreground">{finance ?? "—"}</span>
                </p>
                {canCreateArt && <CreateArtDialog valueStreams={[{ id: vs.id, name: vs.name }]} />}

                {vs.arts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Noch keine ARTs.</p>
                ) : (
                  <div className="space-y-2 pl-4">
                    {vs.arts.map((art) => {
                      const rte = person(art.rteId, userLabels);
                      return (
                        <details key={art.id} open className="rounded-md border bg-background">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                            <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <Link
                              href={`/capacity/arts/${art.id}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {art.name}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              PI {art.piCadenceWeeks} Wo · {art._count.pis} PI
                              {art._count.pis !== 1 ? "s" : ""} · RTE: {rte ?? "—"}
                            </span>
                            <Link
                              href={`/art/${art.id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Planung →
                            </Link>
                            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {art.teams.length} Team{art.teams.length !== 1 ? "s" : ""}
                            </span>
                          </summary>

                          <div className="space-y-2 border-t px-3 py-2">
                            {canCreateTeam && <CreateTeamDialog artId={art.id} />}
                            {art.teams.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Noch keine Teams.</p>
                            ) : (
                              <ul className="space-y-1 pl-4">
                                {art.teams.map((team) => (
                                  <li
                                    key={team.id}
                                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50"
                                  >
                                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <Link
                                      href={`/capacity/teams/${team.id}`}
                                      className="font-medium hover:underline"
                                    >
                                      {team.name}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                      {teamTypeLabel(team.teamType)}
                                      {team.headcount != null ? ` · ${team.headcount} FTE` : ""}
                                      {team._count.sprints > 0
                                        ? ` · ${team._count.sprints} Sprints`
                                        : ""}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
