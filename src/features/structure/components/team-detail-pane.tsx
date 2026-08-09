"use client";

import { teamTypeLabel } from "@/modules/core/org/domain/team-type";
import type { TeamDetail, NodeKind } from "@/modules/core/org/server/views/structure-page";

interface Props {
  team: TeamDetail;
  onSelectNode: (kind: NodeKind, id: string) => void;
}

/**
 * Right pane for a selected Team. Single header card with everything the
 * team carries today — headcount, target velocity, type, scrum master,
 * product owner, sprint count. Teams have no child entities, so no leaf
 * list card.
 */
export function TeamDetailPane({ team, onSelectNode }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Team</p>
        <h2 className="font-heading text-lg font-medium">{team.name}</h2>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">ART</dt>
          <dd>
            <button
              type="button"
              onClick={() => onSelectNode("art", team.artId)}
              className="text-primary hover:underline"
            >
              {team.artName}
            </button>
          </dd>
          <dt className="text-muted-foreground">Typ</dt>
          <dd>{team.teamType ? teamTypeLabel(team.teamType) : "—"}</dd>
          <dt className="text-muted-foreground">Headcount</dt>
          <dd className="tabular-nums">{team.headcount ?? "—"}</dd>
          <dt className="text-muted-foreground">Target Velocity</dt>
          <dd className="tabular-nums">{team.targetVelocity ?? "—"}</dd>
          <dt className="text-muted-foreground">Scrum Master</dt>
          <dd>
            {team.scrumMasterLabel ?? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                Nicht zugewiesen
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Product Owner</dt>
          <dd>
            {team.productOwnerLabel ?? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                Nicht zugewiesen
              </span>
            )}
          </dd>
        </dl>
      </section>
    </div>
  );
}
