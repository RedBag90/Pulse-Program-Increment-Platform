"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer das Recharts-haltige Portfolio-Dashboard.
 */
export const PortfolioDashboard = dynamic(
  () => import("./portfolio-dashboard").then((m) => m.PortfolioDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-96 place-items-center text-sm text-muted-foreground">
        Dashboard wird geladen…
      </div>
    ),
  },
);
