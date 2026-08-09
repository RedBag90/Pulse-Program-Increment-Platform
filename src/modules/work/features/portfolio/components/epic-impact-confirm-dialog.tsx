"use client";

import { useActionState, useState, startTransition, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmEpicImpactAction } from "@/modules/work/features/portfolio/actions/epic-impact";

interface Props {
  epicId: string;
  epicTitle: string;
  /** Wird vom Detail-Header weitergegeben — Anzeige neben dem Confirm. */
  kpiSummary?: {
    progress: number | null;
    tier: "green" | "amber" | "red" | "done" | null;
    count: number;
  };
}

/**
 * Confirm-Impact-Dialog. Wird gerendert, wenn das Epic auf L4 ist UND alle
 * Child-Features `completed` sind (= L4.2 derived). Setzt den
 * Impact-Stempel und schiebt das Epic auf L5.
 */
export function EpicImpactConfirmDialog({ epicId, epicTitle, kpiSummary }: Props) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [state, dispatch, pending] = useActionState(confirmEpicImpactAction, {});

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setComment("");
    }
  }, [state.success]);

  function submit() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    if (comment.trim()) fd.set("comment", comment.trim());
    startTransition(() => dispatch(fd));
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={() => setOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        <CheckCircle2 className="size-4" /> Impact bestätigen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Impact bestätigen — {epicTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <p className="text-muted-foreground">
              Mit der Bestätigung erkennt das Controlling an, dass der prognostizierte Nutzen des
              Epics auf der Balance‑Sheet bzw. an den KPIs sichtbar ist. Das Epic rückt damit auf{" "}
              <strong>L5 „Impact realisiert"</strong>.
            </p>

            {kpiSummary && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <p className="font-medium uppercase tracking-wide text-muted-foreground">
                  KPI-Stand
                </p>
                <p className="mt-1">
                  {kpiSummary.count === 0
                    ? "Keine KPIs hinterlegt."
                    : kpiSummary.progress != null
                      ? `${Math.round(kpiSummary.progress * 100)} % über ${kpiSummary.count} KPI${kpiSummary.count === 1 ? "" : "s"}${kpiSummary.tier ? ` · ${kpiSummary.tier.toUpperCase()}` : ""}`
                      : "KPIs vorhanden, aber noch keine Messwerte."}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="impact-comment">Notiz (optional)</Label>
              <Textarea
                id="impact-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="z. B. Effekt auf welche KPI / welchem Reporting-Zeitraum"
              />
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={submit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {pending ? "Bestätigt…" : "Impact bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
