"use client";

import { useActionState, useState } from "react";
import type { SolutionDetailModel } from "@/modules/core/org/server/views/solution-detail";
import {
  setSolutionLifecycleAction,
  promoteSolutionAction,
} from "@/modules/core/org/features/solution/actions/solution";
import {
  PROMOTION_CRITERIA,
  SOLUTION_STATUSES,
  SOLUTION_STATUS_STEP_LABEL,
  SOLUTION_TRANSITIONS,
  solutionStatusOf,
  solutionStatusToHorizonMode,
} from "@/modules/core/org/domain/solution";
import { HORIZON_BADGE_CLASS } from "@/modules/core/org/features/solution/components/horizon-tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Der Lebenszyklus einer Solution als Sub-Header der Detail-Shell: Kontext-Zeile,
 * **fünfstufige** Leiter und die erlaubten Übergänge.
 *
 * H1 zerfällt sichtbar in `H1.1 · Investing` und `H1.2 · Extracting` — zwei
 * wirtschaftlich verschiedene Phasen, die bis September 2026 als Schieber am
 * rechten Rand hingen: vier Stufen oben, ein Umschalter unten. Der Wechsel von
 * „wir bauen aus" zu „wir melken" war damit optisch kein Schritt auf der Leiter,
 * obwohl er einer ist. Jetzt ist er einer — ein Klick, keine Rückfrage, und der
 * Rückweg bleibt offen.
 *
 * **Gespeichert wird nichts Neues**: weiterhin `horizon` + `investmentMode`. Die
 * Kanten stehen als reine Liste in `domain/solution.ts` und sind dort geprüft;
 * hier wird nur gezeichnet.
 *
 * Bewusst tab-unabhängig — dasselbe Muster wie die Gate-Karte und der
 * Reifegrad-Stepper der Epic-Seite: der Zustandswechsel ist der Vorgang, um den
 * es auf dieser Fläche geht, und muss von jedem Reiter aus erreichbar sein.
 *
 * **Die Kontextzeile „Wertstrom · ART" ist entfallen.** Sie schrieb den Pfad
 * aus, den der Baum links durch die Einrückung ohnehin zeigt. Der Lebenszyklus
 * bleibt — er ist die Aussage dieser Leiste, und er steht nirgends sonst.
 */
export function SolutionLifecycleBar({
  model,
  canManage,
}: {
  model: SolutionDetailModel;
  canManage: boolean;
}) {
  const [, lifecycleAction] = useActionState(setSolutionLifecycleAction, {});
  const [gateOpen, setGateOpen] = useState(false);

  const current = solutionStatusOf(model.horizon, model.investmentMode);

  return (
    <div className="space-y-3">
      {model.description && <p className="max-w-2xl text-sm">{model.description}</p>}

      <div className="flex items-center gap-1">
        {SOLUTION_STATUSES.map((st, i) => {
          const tone = HORIZON_BADGE_CLASS[solutionStatusToHorizonMode(st).horizon];
          const active = st === current;
          return (
            <div key={st} className="flex flex-1 items-center gap-1">
              <div className={cn("flex-1 text-center", active ? "" : "opacity-45")}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    tone.pill,
                    active && "ring-1 ring-current/30",
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
                  {SOLUTION_STATUS_STEP_LABEL[st]}
                </span>
              </div>
              {i < SOLUTION_STATUSES.length - 1 && <div className="h-px w-4 shrink-0 bg-border" />}
            </div>
          );
        })}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {SOLUTION_TRANSITIONS[current].map((t) =>
            t.gate ? (
              <Button key={t.to} size="sm" onClick={() => setGateOpen(true)}>
                {t.label}
              </Button>
            ) : (
              <form key={t.to} action={lifecycleAction}>
                <input type="hidden" name="id" value={model.id} />
                <input type="hidden" name="status" value={t.to} />
                <Button type="submit" size="sm" variant="outline">
                  {t.label}
                </Button>
              </form>
            ),
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
          <DialogTitle>Solution nach H1.1 befördern</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Alle Kriterien bestätigen, um die Solution zur dauerhaften Kern-Solution zu machen. Sie
          landet auf H1.1 · Investing.
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
