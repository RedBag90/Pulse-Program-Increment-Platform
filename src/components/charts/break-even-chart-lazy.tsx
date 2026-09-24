"use client";

import { useTranslations } from "next-intl";
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
    loading: Ladehinweis,
  },
);

/** Eigene Komponente statt einer Pfeilfunktion: `useTranslations` ist ein Hook. */
function Ladehinweis() {
  const t = useTranslations();
  return (
    <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">
      {t("common.charts.kurveWirdGeladen")}
    </div>
  );
}
