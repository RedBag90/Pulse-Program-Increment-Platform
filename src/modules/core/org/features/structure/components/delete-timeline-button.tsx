"use client";

import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteTimelineAction } from "@/modules/core/org/features/structure/actions/timeline";

/**
 * Inline delete trigger for a Timeline. The service refuses while ARTs are
 * still joined — the error bubbles up through the action's state and is shown
 * inline by `<ConfirmMutateForm>`.
 */
export function DeleteTimelineButton({
  timelineId,
  timelineName,
}: {
  timelineId: string;
  timelineName: string;
}) {
  return (
    <ConfirmMutateForm
      action={deleteTimelineAction}
      fields={{ id: timelineId }}
      label={<span className="sr-only">Timeline löschen</span>}
      icon={<Trash2 className="size-4 text-destructive" />}
      confirmPrompt={`Timeline „${timelineName}" wirklich löschen?`}
      variant="ghost"
    />
  );
}
