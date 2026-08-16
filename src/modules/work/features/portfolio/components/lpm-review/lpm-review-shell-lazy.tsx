"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer die Recharts-haltige LPM-Review-Shell (~150kb an
 * Chart-Panels). Wird von der Review-Page eager gerendert — dynamisch geladen,
 * damit die vier Recharts-Panels nicht ins initiale Bundle wandern.
 */
export const LpmReviewShell = dynamic(
  () => import("./lpm-review-shell").then((m) => m.LpmReviewShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-96 place-items-center text-sm text-muted-foreground">
        Portfolio Review wird geladen…
      </div>
    ),
  },
);
