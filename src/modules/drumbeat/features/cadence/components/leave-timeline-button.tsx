"use client";

import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { leaveArtFromTimelineAction } from "@/modules/drumbeat/features/cadence/actions/timeline";

export function LeaveTimelineButton({ artId, artName }: { artId: string; artName: string }) {
  return (
    <ConfirmMutateForm
      action={leaveArtFromTimelineAction}
      fields={{ artId }}
      label="Verlassen"
      pendingLabel="…"
      confirmPrompt={`„${artName}" aus dieser Timeline entfernen? Sprints der Team(s) in den Timeline-PIs werden gelöscht, zugewiesene Features verlieren ihren PI.`}
      variant="ghost"
    />
  );
}
