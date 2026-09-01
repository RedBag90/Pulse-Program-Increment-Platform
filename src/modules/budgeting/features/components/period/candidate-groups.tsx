"use client";

import type { ReactNode } from "react";
import {
  groupCandidates,
  type BusinessGroup,
  type GroupableCandidate,
} from "@/modules/budgeting/domain/candidate-grouping";
import { formatEUR } from "@/lib/formatting";

/**
 * Rendert eine Kandidatenliste gegliedert: **Run/Grow → Wertstrom → Solution**.
 *
 * Eine Komponente für alle Flächen, auf denen Kandidaten stehen — Ballot,
 * Verteil-Seite, Vorschlags-Matrix, Ergebnis und Druckbogen. Die Gliederung
 * selbst rechnet `groupCandidates`; hier liegt nur die Darstellung.
 *
 * Die Solution-Zwischenüberschrift erscheint erst ab zwei Zeilen — über einer
 * einzelnen Zeile trüge sie nichts bei.
 */
export function CandidateGroups<T extends GroupableCandidate>({
  items,
  amount,
  children,
  showTotals = true,
}: {
  items: readonly T[];
  /** Der Betrag, nach dem gegliedert und summiert wird. */
  amount: (item: T) => number;
  /** Rendert eine einzelne Zeile. */
  children: (item: T) => ReactNode;
  showTotals?: boolean;
}) {
  const groups = groupCandidates(items, amount);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <BusinessBlock key={g.kind} group={g} showTotals={showTotals}>
          {children}
        </BusinessBlock>
      ))}
    </div>
  );
}

function BusinessBlock<T extends GroupableCandidate>({
  group,
  showTotals,
  children,
}: {
  group: BusinessGroup<T>;
  showTotals: boolean;
  children: (item: T) => ReactNode;
}) {
  return (
    <section className="rounded-lg border">
      <header
        className={`flex items-baseline justify-between gap-3 border-b px-3 py-2 ${
          group.kind === "run" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40"
        }`}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide">{group.label}</h3>
        {showTotals && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatEUR(group.total)}
          </span>
        )}
      </header>

      <div className="divide-y">
        {group.valueStreams.map((vs) => (
          <div key={vs.name} className="px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-xs font-medium text-muted-foreground">{vs.name}</h4>
              {showTotals && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatEUR(vs.total)}
                </span>
              )}
            </div>

            {vs.solutions.map((sol) => (
              <div key={sol.name} className={sol.heading ? "mt-2" : ""}>
                {sol.heading && (
                  <div className="flex items-baseline justify-between gap-3 border-l-2 border-border pl-2">
                    <span className="text-[11px] text-muted-foreground">{sol.name}</span>
                    {showTotals && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {formatEUR(sol.total)}
                      </span>
                    )}
                  </div>
                )}
                <ul className={`divide-y divide-border/60 ${sol.heading ? "pl-2" : ""}`}>
                  {sol.items.map((item, i) => (
                    <li key={i}>{children(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
