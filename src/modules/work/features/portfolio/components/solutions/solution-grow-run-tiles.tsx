import { formatCompactEUR } from "@/lib/formatting";

/**
 * Die Ökonomie einer Solution in drei Kacheln: Grow (Σ Umsetzungskosten der
 * aktiven Primär-Epics), Run (Σ zugerechnete Betriebskosten p. a.) und ihr
 * Verhältnis.
 *
 * Beide Zahlen sind **abgeleitet** — Run war früher ein freies Feld an der
 * Solution, das niemand budgetiert hat. Es kommt jetzt aus den
 * Run-the-Business-Positionen. Weil die dem Budgeting-Modul gehören, reicht die
 * Route den Wert herein (ADR-0013); `run === null` heißt „Modul nicht aktiv".
 */
export function SolutionGrowRunTiles({
  grow,
  run,
  runItemCount,
}: {
  grow: number;
  /** Σ p. a. der aktiven Positionen; `null` = Budgeting-Modul nicht aktiv. */
  run: number | null;
  runItemCount: number;
}) {
  const total = grow + (run ?? 0);
  const growPct = total > 0 ? Math.round((grow / total) * 100) : 0;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grow · aktive Primär-Epics
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {grow > 0 ? formatCompactEUR(grow) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">Σ Umsetzungskosten (Stage &lt; L5)</div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Run · Betrieb p.a.
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {run == null ? "—" : run > 0 ? formatCompactEUR(run) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {run == null
            ? "Budgeting-Modul nicht aktiv"
            : `aus ${runItemCount} aktiven ${runItemCount === 1 ? "Position" : "Positionen"}`}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Grow : Run</span>
          {run != null && (
            <span className="normal-case text-muted-foreground">
              {growPct}% / {100 - growPct}%
            </span>
          )}
        </div>
        {run == null ? (
          <div className="mt-3 text-xs text-muted-foreground">
            Ohne Betriebskosten kein Verhältnis.
          </div>
        ) : (
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-blue-600" style={{ width: `${growPct}%` }} />
            <div className="h-full bg-slate-400" style={{ width: `${100 - growPct}%` }} />
          </div>
        )}
      </div>
    </section>
  );
}
