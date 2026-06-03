"use client";

import { useActionState, startTransition } from "react";
import { leaveArtFromTimelineAction } from "@/features/structure/actions/timeline";
import { Button } from "@/components/ui/button";

export function LeaveTimelineButton({ artId, artName }: { artId: string; artName: string }) {
  const [state, run, pending] = useActionState(leaveArtFromTimelineAction, {});

  function submit() {
    const msg = `„${artName}" aus dieser Timeline entfernen? Sprints der Team(s) in den Timeline-PIs werden gelöscht, zugewiesene Features verlieren ihren PI.`;
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("artId", artId);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex items-center gap-2">
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={submit}>
        {pending ? "…" : "Verlassen"}
      </Button>
    </div>
  );
}
