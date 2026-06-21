"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer den Recharts-basierten Status-Distribution-Chart
 * (~150kb gzipped). Erst beim Mount der konsumierenden Seite geladen.
 */
export const StatusDistributionChart = dynamic(
  () => import("./status-distribution-chart").then((m) => m.StatusDistributionChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-48 place-items-center text-xs text-muted-foreground">
        Chart wird geladen…
      </div>
    ),
  },
);
