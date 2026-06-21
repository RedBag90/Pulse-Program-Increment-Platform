"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer das Recharts-haltige Budgeting-Board.
 */
export const BudgetingBoard = dynamic(
  () => import("./budgeting-board").then((m) => m.BudgetingBoard),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-96 place-items-center text-sm text-muted-foreground">
        Board wird geladen…
      </div>
    ),
  },
);
