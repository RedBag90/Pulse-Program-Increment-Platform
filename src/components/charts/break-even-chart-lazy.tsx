"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper für die recharts-haltige Break-even-Kurve.
 *
 * Ohne ihn zog die Kurve `recharts` in das Bündel der **ganzen**
 * Epic-Detailseite — von 30,6 kB auf 48,3 kB, für ein Diagramm, das nur einer
 * von neun Reitern zeigt. Dasselbe Muster wie beim Portfolio-Dashboard und beim
 * Netzplan der Abhängigkeiten.
 */
export const BreakEvenChart = dynamic(
  () => import("./break-even-chart").then((m) => m.BreakEvenChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
        Kurve wird geladen…
      </div>
    ),
  },
);
