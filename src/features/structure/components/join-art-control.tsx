"use client";

import { useActionState, useState, startTransition } from "react";
import { joinArtToTimelineAction } from "@/features/structure/actions/timeline";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
  "h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ArtOption {
  id: string;
  name: string;
}

interface TimelineOption {
  id: string;
  name: string;
}

/**
 * Two-direction control around `joinArtToTimeline`:
 * - Per Timeline: pick an unassigned ART and add it.
 * - Per unassigned ART: pick a Timeline and join it.
 *
 * The action audits both directions identically — the UI just chooses the
 * fixed side.
 */
export function JoinArtToTimelineControl({
  timelineId,
  candidates,
}: {
  timelineId: string;
  candidates: ArtOption[];
}) {
  const [artId, setArtId] = useState(candidates[0]?.id ?? "");
  const [state, run, pending] = useActionState(joinArtToTimelineAction, {});

  if (candidates.length === 0) return null;

  function apply() {
    if (!artId) return;
    const fd = new FormData();
    fd.set("artId", artId);
    fd.set("timelineId", timelineId);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        className={SELECT_CLASS}
        value={artId}
        onChange={(e) => setArtId(e.target.value)}
        aria-label="ART hinzufügen"
      >
        {candidates.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={apply}>
        {pending ? "…" : "+ ART beitreten"}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </div>
  );
}

export function AssignTimelineDropdown({
  artId,
  timelines,
}: {
  artId: string;
  timelines: TimelineOption[];
}) {
  const [timelineId, setTimelineId] = useState(timelines[0]?.id ?? "");
  const [state, run, pending] = useActionState(joinArtToTimelineAction, {});

  if (timelines.length === 0) return null;

  function apply() {
    if (!timelineId) return;
    const fd = new FormData();
    fd.set("artId", artId);
    fd.set("timelineId", timelineId);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        className={SELECT_CLASS}
        value={timelineId}
        onChange={(e) => setTimelineId(e.target.value)}
        aria-label="Timeline zuordnen"
      >
        {timelines.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={apply}>
        {pending ? "…" : "Timeline zuordnen"}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
    </div>
  );
}
