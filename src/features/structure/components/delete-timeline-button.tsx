"use client";

import { useActionState, startTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTimelineAction } from "@/features/structure/actions/timeline";
import { Button } from "@/components/ui/button";

/**
 * Inline delete trigger for a Timeline. The service refuses while ARTs are
 * still joined — the error bubbles up through `state.error` and is shown next
 * to the button.
 */
export function DeleteTimelineButton({
  timelineId,
  timelineName,
}: {
  timelineId: string;
  timelineName: string;
}) {
  const [state, run, pending] = useActionState(deleteTimelineAction, {});

  function submit() {
    if (!window.confirm(`Timeline „${timelineName}" wirklich löschen?`)) return;
    const fd = new FormData();
    fd.set("id", timelineId);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex items-center gap-2">
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={submit}
        aria-label="Timeline löschen"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
