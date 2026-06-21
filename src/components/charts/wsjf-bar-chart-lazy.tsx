"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer den Recharts-basierten WSJF-Chart (~150kb gzipped).
 * Erst beim Mount der Reporting-Seite geladen.
 */
export const WsjfBarChart = dynamic(() => import("./wsjf-bar-chart").then((m) => m.WsjfBarChart), {
  ssr: false,
  loading: () => (
    <div className="grid h-64 place-items-center text-xs text-muted-foreground">
      Chart wird geladen…
    </div>
  ),
});
