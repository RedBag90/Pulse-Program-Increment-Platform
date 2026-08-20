"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper um den Recharts-basierten Wertstrom-Chart (`ssr:false`), damit die
 * Recharts-Bundle-Last erst geladen wird, wenn die Wertströme-Ebene sichtbar ist.
 */
export const ValueStreamChart = dynamic(
  () =>
    import("@/modules/budgeting/features/components/board/value-stream-chart").then(
      (m) => m.ValueStreamChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[300px] place-items-center text-xs text-muted-foreground">
        Chart wird geladen…
      </div>
    ),
  },
);
