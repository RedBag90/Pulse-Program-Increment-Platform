import { Target } from "lucide-react";
import { ObjectiveConfidenceVote } from "@/features/pi/components/objective-confidence-vote";
import { CreatePiObjectiveDialog } from "@/features/pi/components/create-pi-objective-dialog";

export interface ObjectiveRow {
  id: string;
  title: string;
  description: string | null;
  businessValue: number | null;
  committed: boolean;
  confidence: number | null;
  teamId: string;
  teamName: string;
  /** ART des Teams — wird vom Confidence-Vote-Service als Capability-Scope verwendet. */
  artId: string | null;
}

interface TeamOption {
  id: string;
  name: string;
  artId: string;
}

interface Props {
  piId: string;
  rows: ObjectiveRow[];
  /** Teams der ARTs, die diesen PI tragen — fuer den Create-Dialog. */
  teams: TeamOption[];
  canVote: boolean;
  canCreate: boolean;
}

/**
 * Objectives-Tab des PI-Workspaces. Gruppiert Objectives nach Team,
 * zeigt Committed/Uncommitted-Pille, Business-Value und einen SAFe-
 * Fist-of-Five-Confidence-Vote. Wiederverwendet die bestehenden
 * `ObjectiveConfidenceVote` und `CreatePiObjectiveDialog`.
 */
export function PiObjectivesTab({ piId, rows, teams, canVote, canCreate }: Props) {
  const byTeam = new Map<string, ObjectiveRow[]>();
  for (const r of rows) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, []);
    byTeam.get(r.teamId)!.push(r);
  }
  const teamOrder = [...byTeam.keys()].sort((a, b) => {
    const aName = byTeam.get(a)![0]!.teamName;
    const bName = byTeam.get(b)![0]!.teamName;
    return aName.localeCompare(bName, "de");
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">PI Objectives</h2>
          <p className="text-sm text-muted-foreground">
            Pro Team committete und uncommittete Ziele mit SAFe Fist-of-Five Confidence-Vote.
          </p>
        </div>
        {canCreate && <CreatePiObjectiveDialog piId={piId} teams={teams} />}
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          Noch keine Objectives. Lege je Team mindestens ein committed Objective an — Pre-Check fuer
          den PI-Start.
        </p>
      ) : (
        <div className="space-y-4">
          {teamOrder.map((tid) => {
            const teamRows = byTeam.get(tid)!;
            return (
              <section key={tid} className="rounded-lg border bg-card">
                <header className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
                  {teamRows[0]!.teamName}
                </header>
                <ul className="divide-y">
                  {teamRows.map((row) => (
                    <li key={row.id} className="space-y-2 px-4 py-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{row.title}</span>
                            {!row.committed && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                                Uncommitted
                              </span>
                            )}
                            {row.businessValue != null && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                                BV {row.businessValue}
                              </span>
                            )}
                          </div>
                          {row.description && (
                            <p className="text-sm text-muted-foreground">{row.description}</p>
                          )}
                        </div>
                        {row.artId && (
                          <ObjectiveConfidenceVote
                            objectiveId={row.id}
                            artId={row.artId}
                            current={row.confidence}
                            canVote={canVote}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
