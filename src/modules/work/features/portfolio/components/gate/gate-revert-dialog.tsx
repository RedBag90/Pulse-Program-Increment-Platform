"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, startTransition } from "react";
import { Undo2 } from "lucide-react";
import { revertStageGateAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";
import { gateStepLabel } from "@/modules/work/domain/stage-gate";

/**
 * Rückstufung um genau einen Reifegrad.
 *
 * Bewusst als eigene, sparsam platzierte Geste — nicht als zweite Richtung des
 * Push-Buttons: eine Rückstufung räumt Freigabe-Stempel ab und zieht einen
 * offenen Antrag mit zurück. Die Begründung ist Pflicht, weil dieser Vorgang in
 * die Historie eingreift.
 */
export function GateRevertDialog({ epicId, current }: { epicId: string; current: GateStep }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(revertStageGateAction, {});
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const index = GATE_STEPS.indexOf(current);
  const target = index > 0 ? (GATE_STEPS[index - 1] as GateStep) : null;
  if (!target) return null;

  function submit() {
    if (!reason.trim() || !target) return;
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", target);
    fd.set("reason", reason.trim());
    startTransition(() => action(fd));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <Undo2 className="size-3.5" />
        {t("work.gate.zurueckstufen")}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-warning/40 bg-warning-surface/60 p-2.5">
      <p className="text-xs font-medium">
        Zurückstufen auf {gateStepLabel(target, t)} — bitte begründen
      </p>
      <p className="text-xs text-muted-foreground">
        Die Freigabe-Stempel des verlassenen Reifegrads werden dabei zurückgesetzt; ein offener
        Antrag wird zurückgezogen.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t("work.gate.begruendungErforderlich")}
        className="w-full rounded-md border border-input px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !reason.trim()}
          onClick={submit}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive-surface disabled:opacity-50"
        >
          {pending ? "…" : "Zurückstufen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {t("work.gate.abbrechen")}
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
