"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { ArtBudgetBreakdown } from "@/modules/budgeting/features/components/art-budget/art-budget-breakdown";
import type { ArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";

/**
 * ART-Budgets eines Wertstroms — **read-only**.
 *
 * Sie werden nicht mehr von Hand verteilt: das Budget eines ART ist die Summe
 * der final zugeteilten Beträge seiner Epics, je Halbjahr der Kachel, aus der
 * die Zuteilung stammt. Vorher stand hier ein editierbares Grid neben derselben
 * Zahl in der Kachel — zwei Wahrheiten für dieselbe Sache.
 */
export function ArtBudgetView({ model }: { model: ArtBudgetModel }) {
  // Das Grid ist kontrolliert; im Lesemodus ist der Stand einfach der Server-Stand.
  const budgets = useMemo(
    () =>
      Object.fromEntries(
        model.rows.map((r) => [
          r.artId,
          Object.fromEntries(
            model.periods.map((p) => [
              p.key,
              r.budgetByPeriod[p.key] ? String(r.budgetByPeriod[p.key]) : "",
            ]),
          ),
        ]),
      ),
    [model],
  );

  return (
    <div className="space-y-2">
      <ArtBudgetBreakdown model={model} budgets={budgets} onChange={() => {}} canEdit={false} />
      <p className="text-xs text-muted-foreground">
        Abgeleitet aus der Finalisierung der Budgeting-Zeiträume.{" "}
        <Link href="/budgeting/periods" className="text-primary hover:underline">
          Zu den Zeiträumen →
        </Link>
      </p>
    </div>
  );
}
