"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { nextCycle, MIN_WINDOW_SIZE, MAX_WINDOW_SIZE } from "@/modules/budgeting/domain/budget-cycle";
import {
  advanceBudgetCycleAction,
  setBudgetWindowSizeAction,
} from "@/modules/budgeting/features/actions/budgeting";

interface Props {
  activeCycleKey: string;
  windowLabel: string;
  windowSize: number;
  canManage: boolean;
  canAdvance: boolean;
}

/**
 * Rolling-Window-Steuerung im Runde-Header: zeigt die Fenster-Spanne, erlaubt die
 * Fenstergröße zu ändern und den Zyklus fortzuschreiben (ablaufenden Zyklus
 * einfrieren + Anker `+1`). Das Fortschreiben verlangt eine Inline-Bestätigung.
 */
export function CycleControls({ activeCycleKey, windowLabel, windowSize, canManage, canAdvance }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLabel = halfYearLabel(activeCycleKey);
  const nextLabel = halfYearLabel(nextCycle(activeCycleKey));

  async function setSize(size: number) {
    if (size < MIN_WINDOW_SIZE || size > MAX_WINDOW_SIZE) return;
    setPending(true);
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ size }));
    const res = await setBudgetWindowSizeAction({}, fd);
    setPending(false);
    if (!res.error) router.refresh();
  }

  async function advance() {
    setPending(true);
    setError(null);
    const res = await advanceBudgetCycleAction({}, new FormData());
    setPending(false);
    if (res.error) setError(res.error);
    else {
      setConfirming(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Fenster: <span className="font-medium text-foreground">{windowLabel}</span>
        </span>
        {canManage && (
          <span className="inline-flex items-center gap-1">
            Größe
            <button
              type="button"
              aria-label="Fenster verkleinern"
              disabled={pending || windowSize <= MIN_WINDOW_SIZE}
              onClick={() => setSize(windowSize - 1)}
              className="grid size-6 place-items-center rounded-md border hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-14 text-center font-medium text-foreground">{windowSize} HJ</span>
            <button
              type="button"
              aria-label="Fenster vergrößern"
              disabled={pending || windowSize >= MAX_WINDOW_SIZE}
              onClick={() => setSize(windowSize + 1)}
              className="grid size-6 place-items-center rounded-md border hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      {canAdvance &&
        (confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {activeLabel} einfrieren &amp; {nextLabel} öffnen?
            </span>
            {error && <span className="text-xs text-destructive">{error}</span>}
            <Button type="button" size="sm" disabled={pending} onClick={advance}>
              {pending ? "Schreibt fort…" : "Fortschreiben"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
            Zyklus abschließen &amp; fortschreiben
          </Button>
        ))}
    </div>
  );
}
