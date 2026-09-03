import { formatEUR } from "@/lib/formatting";
import type { ValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";

/**
 * Der Budgetplan eines Wertstroms je Halbjahr — **abgeleitet**, nicht gepflegt:
 * die Summe dessen, was die Kacheln den Epics dieses Wertstroms zugeteilt haben.
 *
 * Lag als seitenlokale Funktion in der Wertstrom-Detailseite. Sie gehört ins
 * Budgeting-Modul, weil sie Budgeting-Wissen darstellt und die Seite nur der
 * Ort ist, an dem sie erscheint (ADR-0013: die App-Shell führt Module
 * zusammen, sie beherbergt sie nicht).
 */
export function ValueStreamBudgetPlan({
  periods,
  plan,
}: {
  periods: { key: string; label: string }[];
  plan: ValueStreamBudget | undefined;
}) {
  const hasAny = periods.some((p) => (plan?.byPeriod[p.key] ?? 0) > 0);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Budgetplan</h2>
      <p className="text-xs text-muted-foreground">
        Automatisch aus den Participatory-Budgeting-Zuteilungen der Epics dieses Wertstroms.
      </p>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">Noch kein Budget zugeteilt.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                {periods.map((p) => (
                  <th key={p.key} className="p-2 text-right font-medium">
                    {p.label}
                  </th>
                ))}
                <th className="p-2 text-right font-medium">Summe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {periods.map((p) => (
                  <td key={p.key} className="p-2 text-right tabular-nums">
                    {formatEUR(plan?.byPeriod[p.key] ?? 0)}
                  </td>
                ))}
                <td className="p-2 text-right font-medium tabular-nums">
                  {formatEUR(plan?.total ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
