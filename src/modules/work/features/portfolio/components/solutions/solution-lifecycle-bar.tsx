"use client";

import { useActionState, useState } from "react";
import type { SolutionDetailModel } from "@/modules/work/server/views/solution-detail";
import {
  setSolutionLifecycleAction,
  promoteSolutionAction,
  setSolutionInvestmentModeAction,
} from "@/modules/work/features/portfolio/actions/solution";
import { PROMOTION_CRITERIA } from "@/modules/work/domain/solution";
import { type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/** Erlaubte Lifecycle-Übergänge je aktuellem Horizont (vor-/rückwärts). */
const TRANSITIONS: Record<Horizon, { to: Horizon; label: string; gate?: boolean }[]> = {
  h3: [{ to: "h2", label: "Nach H2 (Emerging)" }],
  h2: [
    { to: "h1", label: "Nach H1 befördern", gate: true },
    { to: "h3", label: "Zurück zu H3" },
  ],
  h1: [
    { to: "h0", label: "Stilllegen (H0)" },
    { to: "h2", label: "Zurück zu H2" },
  ],
  h0: [{ to: "h1", label: "Reaktivieren (H1)" }],
};

const ORDER: Horizon[] = ["h3", "h2", "h1", "h0"];

/**
 * Der Lifecycle einer Solution als Sub-Header der Detail-Shell: Kontext-Zeile,
 * Horizont-Stepper und die erlaubten Übergänge.
 *
 * Bewusst tab-unabhängig — dasselbe Muster wie die Gate-Karte und der
 * Reifegrad-Stepper der Epic-Seite: der Zustandswechsel ist der Vorgang, um den
 * es auf dieser Fläche geht, und muss von jedem Reiter aus erreichbar sein.
 */
export function SolutionLifecycleBar({
  model,
  canManage,
}: {
  model: SolutionDetailModel;
  canManage: boolean;
}) {
  const [, lifecycleAction] = useActionState(setSolutionLifecycleAction, {});
  const [, modeAction] = useActionState(setSolutionInvestmentModeAction, {});
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {[model.valueStreamName ?? "—", model.artName ?? "kein ART"].join(" · ")}
      </p>
      {model.description && <p className="max-w-2xl text-sm">{model.description}</p>}

      <div className="flex items-center gap-1">
        {ORDER.map((h, i) => (
          <div key={h} className="flex flex-1 items-center gap-1">
            <div className={`flex-1 text-center ${h === model.horizon ? "" : "opacity-45"}`}>
              <HorizonBadge horizon={h} />
            </div>
            {i < ORDER.length - 1 && <div className="h-px w-4 shrink-0 bg-border" />}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {TRANSITIONS[model.horizon].map((t) =>
            t.gate ? (
              <Button key={t.to} size="sm" onClick={() => setGateOpen(true)}>
                {t.label}
              </Button>
            ) : (
              <form key={t.to} action={lifecycleAction}>
                <input type="hidden" name="id" value={model.id} />
                <input type="hidden" name="horizon" value={t.to} />
                <Button type="submit" size="sm" variant="outline">
                  {t.label}
                </Button>
              </form>
            ),
          )}

          {/* Invest/Extract nur in H1 — davor gibt es nichts zu ernten. */}
          {model.horizon === "h1" && (
            <div className="ml-auto inline-flex overflow-hidden rounded-md border text-xs">
              {(["investing", "extracting"] as const).map((mode) => (
                <form key={mode} action={modeAction}>
                  <input type="hidden" name="id" value={model.id} />
                  <input type="hidden" name="investmentMode" value={mode} />
                  <button
                    type="submit"
                    className={`px-3 py-1.5 font-medium ${
                      model.investmentMode === mode
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "investing" ? "Investing" : "Extracting"}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <TransitionGateDialog solutionId={model.id} open={gateOpen} onOpenChange={setGateOpen} />
      )}
    </div>
  );
}

function TransitionGateDialog({
  solutionId,
  open,
  onOpenChange,
}: {
  solutionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, action, pending] = useActionState(promoteSolutionAction, {});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = PROMOTION_CRITERIA.every((c) => checked[c.key]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solution nach H1 befördern</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Alle Kriterien bestätigen, um die Solution zur dauerhaften Kern-Solution (H1) zu machen.
        </p>
        <form action={action} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={solutionId} />
          {PROMOTION_CRITERIA.map((c) => (
            <label key={c.key} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <input
                type="checkbox"
                name={c.key}
                checked={checked[c.key] ?? false}
                onChange={(e) => setChecked((p) => ({ ...p, [c.key]: e.target.checked }))}
                className="mt-0.5 size-4 accent-blue-600"
              />
              {c.label}
            </label>
          ))}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!allChecked || pending}>
              {pending ? "…" : "Befördern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
