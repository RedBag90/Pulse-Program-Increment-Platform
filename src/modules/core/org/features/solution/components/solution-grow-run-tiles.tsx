import { useTranslations } from "next-intl";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Die Ökonomie einer Solution in drei Kacheln: Grow (Σ Umsetzungskosten der
 * aktiven Primär-Epics), Run (Σ zugerechnete Betriebskosten p. a.) und ihr
 * Verhältnis.
 *
 * Beide Zahlen sind **abgeleitet** — Run war früher ein freies Feld an der
 * Solution, das niemand budgetiert hat. Es kommt jetzt aus den
 * Run-the-Business-Positionen.
 *
 * Und beide gehören oberen Modulen: Run dem Budgeting, Grow seit ADR-0022 dem
 * Work-Modul. Die Route reicht sie herein (ADR-0013); `null` heißt jeweils
 * „Modul nicht aktiv" — im Unterschied zu 0 €, was „nichts investiert" hieße.
 */
export function SolutionGrowRunTiles({
  grow,
  run,
  runItemCount,
  cycleLabel,
}: {
  /** Σ Umsetzungskosten aktiver Primär-Epics; `null` = Work-Modul nicht aktiv. */
  grow: number | null;
  /** Σ p. a. der aktiven Positionen; `null` = Budgeting-Modul nicht aktiv. */
  run: number | null;
  runItemCount: number;
  /** Das Halbjahr, auf dem **beide** Beträge stehen; `null` ohne Budgeting. */
  cycleLabel: string | null;
}) {
  const t = useTranslations();
  const total = (grow ?? 0) + (run ?? 0);
  const growPct = total > 0 ? Math.round(((grow ?? 0) / total) * 100) : 0;

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg bg-card p-4 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("org.ui.growZugeteilt")}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {grow == null ? "—" : grow > 0 ? formatCompactEUR(grow) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {grow == null
            ? t("org.ui.growRunWorkOderBudgetingInaktiv")
            : (cycleLabel ?? t("org.ui.growRunLaufendesHalbjahr"))}
        </div>
      </div>

      <div className="rounded-lg bg-card p-4 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("org.ui.runBetrieb")}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {run == null ? "—" : run > 0 ? formatCompactEUR(run) : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {run == null
            ? t("org.ui.growRunBudgetingInaktiv")
            : t(
                runItemCount === 1
                  ? "org.ui.growRunAktivePositionEine"
                  : "org.ui.growRunAktivePositionenViele",
                {
                  cycle: cycleLabel ?? t("org.ui.growRunLaufendesHalbjahr"),
                  count: runItemCount,
                },
              )}
        </div>
      </div>

      <div className="rounded-lg bg-card p-4 shadow-card">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{t("org.ui.growRun")}</span>
          {run != null && grow != null && (
            <span className="normal-case text-muted-foreground">
              {growPct}% / {100 - growPct}%
            </span>
          )}
        </div>
        {run == null || grow == null ? (
          <div className="mt-3 text-xs text-muted-foreground">
            {grow == null
              ? t("org.ui.growRunOhneGrowKeinVerhaeltnis")
              : t("org.ui.growRunOhneBetriebKeinVerhaeltnis")}
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
