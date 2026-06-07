"use client";

import { ArrowRight, Calendar } from "lucide-react";
import { JoinArtToTimelineControl } from "@/features/structure/components/join-art-control";
import { DeleteTimelineButton } from "@/features/structure/components/delete-timeline-button";
import { LeaveTimelineButton } from "@/features/structure/components/leave-timeline-button";
import {
  AddStandardPisControl,
  type PiStandardOption,
} from "@/features/structure/components/add-standard-pis-control";
import type { TimelineDetail, NodeKind } from "@/server/views/structure-page";

interface Props {
  timeline: TimelineDetail;
  canManage: boolean;
  /** Verfügbare PI-Standards für den „Standard anwenden"-Pfad — der einzige
   *  user-facing Pfad, über den neue PIs entstehen. */
  piStandards: PiStandardOption[];
  onSelectNode: (kind: NodeKind, id: string) => void;
}

const PI_STATUS_LABEL: Record<string, string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

/**
 * Right pane for a selected Timeline. Four cards:
 *
 * - **Header** — name + cadence + counts + Delete button.
 * - **PIs** — chronological list of Program Increments with status pill.
 * - **Subscribed ARTs** — click-to-select; each carries a Leave button.
 * - **Unassigned ARTs** — the existing `<JoinArtToTimelineControl>` to add
 *   one. Only shown when there are unassigned ARTs available.
 */
export function TimelineDetailPane({ timeline, canManage, piStandards, onSelectNode }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</p>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-heading text-lg font-medium">{timeline.name}</h2>
          {canManage && (
            <DeleteTimelineButton timelineId={timeline.id} timelineName={timeline.name} />
          )}
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Cadence</dt>
          <dd className="tabular-nums">{timeline.cadenceWeeks} Wochen</dd>
          <dt className="text-muted-foreground">PIs / ARTs</dt>
          <dd className="tabular-nums">
            {timeline.pis.length} / {timeline.subscribedArts.length}
          </dd>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-heading text-sm font-medium">Program Increments</h2>
          {canManage && <AddStandardPisControl timelineId={timeline.id} standards={piStandards} />}
        </div>
        {timeline.pis.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine PIs. PIs entstehen aus dem PI-Standard, der oben auf diese Timeline
            angewendet wird.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {timeline.pis.map((pi) => (
              <li
                key={pi.id}
                className="flex items-center gap-3 rounded-md border bg-card px-3 py-1.5 text-sm"
              >
                <Calendar className="size-3.5 text-muted-foreground" />
                <span className="flex-1 font-medium">{pi.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pi.startDate} → {pi.endDate}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                    pi.status === "active"
                      ? "bg-primary/10 text-primary"
                      : pi.status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {PI_STATUS_LABEL[pi.status] ?? pi.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-heading text-sm font-medium">Verknüpfte ARTs</h2>
        {timeline.subscribedArts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine ARTs dieser Timeline beigetreten.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {timeline.subscribedArts.map((art) => (
              <li
                key={art.id}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onSelectNode("art", art.id)}
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                >
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{art.name}</span>
                  {art.valueStreamName && (
                    <span className="text-xs text-muted-foreground">· {art.valueStreamName}</span>
                  )}
                </button>
                {canManage && <LeaveTimelineButton artId={art.id} artName={art.name} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && timeline.unassignedArts.length > 0 && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-heading text-sm font-medium">ART hinzufügen</h2>
          <JoinArtToTimelineControl
            timelineId={timeline.id}
            candidates={timeline.unassignedArts.map((a) => ({ id: a.id, name: a.name }))}
          />
        </section>
      )}
    </div>
  );
}
