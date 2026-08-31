"use client";

import { useActionState } from "react";
import type { SolutionDetailModel } from "@/modules/work/server/views/solution-detail";
import { setSolutionRunAction } from "@/modules/work/features/portfolio/actions/solution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Die Ökonomie einer Solution in drei Kacheln: Grow (Σ Umsetzungskosten der
 * aktiven Primär-Epics), Run (manuell gepflegte Baseline p. a.) und ihr
 * Verhältnis. Der Run-Wert ist das einzige Feld, das hier geschrieben wird —
 * dafür ist die Kachel-Reihe eine Client-Komponente.
 */
export function SolutionRunGrowTiles({
  model,
  canManage,
}: {
  model: SolutionDetailModel;
  canManage: boolean;
}) {
  const [state, runAction, pending] = useActionState(setSolutionRunAction, {});
  const run = model.run ?? 0;
  const total = model.grow + run;
  const growPct = total > 0 ? Math.round((model.grow / total) * 100) : 0;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grow · aktive Primär-Epics
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {model.grow > 0 ? formatCompactEUR(model.grow) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">Σ Umsetzungskosten (Stage &lt; L5)</div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Run · Baseline p.a.
        </div>
        {canManage ? (
          <form action={runAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={model.id} />
            <Input
              name="runBaselineAmount"
              type="number"
              min={0}
              step={1000}
              defaultValue={model.run ?? ""}
              className="h-8 w-36 text-right tabular-nums"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Speichern"}
            </Button>
          </form>
        ) : (
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {model.run != null ? formatCompactEUR(model.run) : "—"}
          </div>
        )}
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Grow : Run</span>
          <span className="normal-case text-muted-foreground">
            {growPct}% / {100 - growPct}%
          </span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-blue-600" style={{ width: `${growPct}%` }} />
          <div className="h-full bg-slate-400" style={{ width: `${100 - growPct}%` }} />
        </div>
      </div>
    </section>
  );
}
