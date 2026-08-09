"use client";

import { ArrowRight } from "lucide-react";
import { CreateTeamDialog } from "@/modules/core/org/features/team/components/create-team-dialog";
import { EditArtDialog } from "@/modules/core/org/features/art/components/edit-art-dialog";
import { DeleteArtButton } from "@/modules/core/org/features/art/components/delete-art-button";
import type { ArtDetail, NodeKind } from "@/modules/core/org/server/views/structure-page";

interface Props {
  art: ArtDetail;
  canCreateTeam: boolean;
  canUpdateArt: boolean;
  canDeleteArt: boolean;
  onSelectNode: (kind: NodeKind, id: string) => void;
}

/**
 * Right pane for a selected ART. Three cards:
 *
 * - **Header** — name + parent VS + RTE + Timeline + cadence + counts.
 *   Missing RTE shows as an amber chip.
 * - **Teams** — child Team rows; click to re-select. "+ Team hinzufügen"
 *   opens the existing `<CreateTeamDialog>` pre-bound to this ART.
 * - **Timeline** — current Timeline name (clickable to navigate the
 *   selection to the Timeline detail), or a hint if the ART hasn't joined
 *   one yet.
 */
export function ArtDetailPane({
  art,
  canCreateTeam,
  canUpdateArt,
  canDeleteArt,
  onSelectNode,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">ART</p>
            <h2 className="font-heading text-lg font-medium">{art.name}</h2>
          </div>
          {(canUpdateArt || canDeleteArt) && (
            <div className="flex items-center gap-1">
              {canUpdateArt && (
                <EditArtDialog
                  id={art.id}
                  name={art.name}
                  description={art.description}
                  piCadenceWeeks={art.piCadenceWeeks}
                />
              )}
              {canDeleteArt && <DeleteArtButton id={art.id} name={art.name} />}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Wertstrom</dt>
          <dd>
            <button
              type="button"
              onClick={() => onSelectNode("vs", art.valueStreamId)}
              className="text-primary hover:underline"
            >
              {art.valueStreamName}
            </button>
          </dd>
          <dt className="text-muted-foreground">RTE</dt>
          <dd>
            {art.rteLabel ?? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                Nicht zugewiesen
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">PI-Cadence</dt>
          <dd className="tabular-nums">{art.piCadenceWeeks} Wochen</dd>
          <dt className="text-muted-foreground">PIs / Teams</dt>
          <dd className="tabular-nums">
            {art.piCount} / {art.teamCount}
          </dd>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-medium">Teams</h2>
          {canCreateTeam && <CreateTeamDialog artId={art.id} />}
        </div>
        {art.teamIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Teams — mit „Team anlegen“ das erste erstellen.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {art.teamIds.map((tid) => (
              <li key={tid}>
                <button
                  type="button"
                  onClick={() => onSelectNode("team", tid)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>Team {tid.slice(0, 8)}…</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-heading text-sm font-medium">Timeline</h2>
        {art.timelineId && art.timelineName ? (
          <button
            type="button"
            onClick={() => onSelectNode("timeline", art.timelineId!)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{art.timelineName}</span>
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Dieser ART ist noch keiner Timeline beigetreten — wähle eine Timeline aus der Liste und
            nutze dort „ART hinzufügen“.
          </p>
        )}
      </section>
    </div>
  );
}
