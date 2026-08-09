"use client";

import { useActionState, startTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePiOnTimelineAction } from "@/modules/drumbeat/features/timeline/actions/pi";
import type { ActionState } from "@/server/http/server-action";

const initialState: ActionState = {};

interface Props {
  piId: string;
  piName: string;
  /** Wenn der PI-Status NICHT planned ist, ist der Button disabled. */
  disabled: boolean;
}

/**
 * Inline-Trash-Icon-Button fuer PIs in der Liste. Nur fuer `planned` PIs;
 * bei anderen status-werten ist der button disabled mit tooltip.
 */
export function DeletePiRowButton({ piId, piName, disabled }: Props) {
  const [state, action, pending] = useActionState(deletePiOnTimelineAction, initialState);

  const onClick = () => {
    if (!confirm(`PI "${piName}" wirklich loeschen?`)) return;
    const fd = new FormData();
    fd.set("id", piId);
    startTransition(() => action(fd));
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        title={disabled ? "Nur planned-PIs sind loeschbar" : pending ? "Loesche…" : "PI loeschen"}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        aria-label={`PI ${piName} loeschen`}
      >
        <Trash2 className="size-3.5" />
      </button>
      {state?.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </span>
  );
}
