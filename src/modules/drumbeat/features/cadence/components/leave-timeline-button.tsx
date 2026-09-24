"use client";

import { useTranslations } from "next-intl";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { leaveArtFromTimelineAction } from "@/modules/drumbeat/features/cadence/actions/timeline";

export function LeaveTimelineButton({ artId, artName }: { artId: string; artName: string }) {
  const t = useTranslations();
  return (
    <ConfirmMutateForm
      action={leaveArtFromTimelineAction}
      fields={{ artId }}
      label={t("drumbeat.ui.verlassen")}
      pendingLabel="…"
      confirmPrompt={`„${artName}" aus dieser Timeline entfernen? Sprints der Team(s) in den Timeline-PIs werden gelöscht, zugewiesene Features verlieren ihren PI.`}
      variant="ghost"
    />
  );
}
