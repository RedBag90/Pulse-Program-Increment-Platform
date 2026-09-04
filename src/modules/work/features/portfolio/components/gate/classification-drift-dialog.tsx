"use client";

import { useState, useActionState, startTransition } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEUR } from "@/lib/formatting";
import { setPortfolioOverrideAction } from "@/modules/work/features/portfolio/actions/epic";
import { EPIC_CLASS_LABELS, type ClassificationDrift } from "@/modules/work/domain/pb-submission";

export interface DriftInfo {
  drift: ClassificationDrift;
  intended: "portfolio" | "art";
  derived: "portfolio" | "art";
  cost: number | null;
  threshold: number;
  valueStreamId: string;
  /** Trägt der Betrachter `epic.portfolio_override`? Ohne das nur der Hinweis. */
  canOverride: boolean;
}

/**
 * Der Zwischenruf vor dem L3.1-Antrag: der Business Case widerlegt die
 * Erwartung, mit der dieses Epic angelegt wurde.
 *
 * In **beide** Richtungen ein Hinweis — beide sind eine Überraschung, und wer
 * einreicht, soll sie nicht erst hinterher bemerken. Bestehen darf man aber nur
 * in **einer**: bleibt es Portfolio-Sache, obwohl die Kosten unter dem Limit
 * liegen, ist das eine Ausnahme, die jemand mit dem Recht begründen kann. In
 * die andere Richtung bindet die Kostenregel — was über dem Limit liegt,
 * braucht eine Portfolio-Entscheidung, und ein ART-Rahmen könnte es ohnehin
 * nicht tragen.
 */
export function ClassificationDriftDialog({
  epicId,
  info,
  open,
  onOpenChange,
  onProceed,
}: {
  epicId: string;
  info: DriftInfo;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Weiter zum Antrag — die abgeleitete Klasse gilt. */
  onProceed: () => void;
}) {
  const [reason, setReason] = useState("");
  const [state, submitOverride, busy] = useActionState(setPortfolioOverrideAction, {});
  const mayInsist = info.drift === "down" && info.canOverride;

  function insist() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("valueStreamId", info.valueStreamId);
    fd.set("reason", reason);
    startTransition(() => {
      submitOverride(fd);
      onProceed();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden />
            Die Einordnung ändert sich
          </DialogTitle>
          <DialogDescription>
            Angelegt wurde dieses Epic als{" "}
            <strong className="font-medium">{EPIC_CLASS_LABELS[info.intended]}</strong>. Der
            Business Case beziffert die Umsetzung auf{" "}
            <strong className="font-medium tabular-nums">
              {info.cost != null ? formatEUR(info.cost) : "—"}
            </strong>{" "}
            {info.drift === "up" ? "über" : "unter"} dem Portfolio-Limit von{" "}
            <span className="tabular-nums">{formatEUR(info.threshold)}</span> — damit wird es zum{" "}
            <strong className="font-medium">{EPIC_CLASS_LABELS[info.derived]}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {info.drift === "up" ? (
            <p className="text-muted-foreground">
              Daran lässt sich nichts ändern: was über dem Limit liegt, braucht eine
              Portfolio-Entscheidung und läuft über eine Budget-Kachel. Ein ART-Rahmen könnte es
              nicht tragen.
            </p>
          ) : mayInsist ? (
            <>
              <p className="text-muted-foreground">
                Es hängt künftig am ART-Epic-Budget seines ARTs statt an der PB-Liste. Wenn es aus
                anderen Gründen Portfolio-Sache bleiben soll, halte den Grund fest.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="drift-reason">Begründung für die Ausnahme</Label>
                <Textarea
                  id="drift-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="z. B. strategische Abhängigkeit zu einem anderen Wertstrom"
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Es hängt künftig am ART-Epic-Budget seines ARTs statt an der PB-Liste. Eine Ausnahme
              davon kann nur das Portfolio erklären.
            </p>
          )}

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          {mayInsist && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || reason.trim() === ""}
              onClick={insist}
            >
              Portfolio-Sache bleiben
            </Button>
          )}
          <Button type="button" onClick={onProceed}>
            Verstanden, beantragen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
