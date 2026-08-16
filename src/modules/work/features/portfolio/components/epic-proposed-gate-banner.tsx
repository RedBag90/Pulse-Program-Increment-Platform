"use client";

import { useActionState, startTransition } from "react";
import { ArrowUp } from "lucide-react";
import { confirmProposedStageGateAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

interface Props {
  epicId: string;
  /** The persisted gate proposal, e.g. "L3". */
  proposedStageGate: string;
}

/**
 * Suggest-confirm banner: a content trigger has proposed the next gate and the
 * viewer holds the portfolio-scoped `epic.approve` capability. Confirming
 * dispatches the owner-confirm action, which advances the Epic one gate.
 */
export function EpicProposedGateBanner({ epicId, proposedStageGate }: Props) {
  const [state, action, pending] = useActionState(confirmProposedStageGateAction, {});
  const label = STAGE_GATE_LABELS[proposedStageGate] ?? proposedStageGate;

  function confirm() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    startTransition(() => action(fd));
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3.5 py-2.5">
      <p className="flex-1 text-sm">
        <span className="font-medium">Gate-Vorschlag:</span> nach {label}
      </p>
      <button
        type="button"
        onClick={confirm}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <ArrowUp className="size-3.5" />
        {pending ? "…" : "Bestätigen"}
      </button>
      {state.error && <span className="w-full text-xs text-destructive">{state.error}</span>}
    </div>
  );
}
