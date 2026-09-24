"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer das Recharts-haltige Portfolio-Dashboard.
 */
export const PortfolioDashboard = dynamic(
  () => import("./portfolio-dashboard").then((m) => m.PortfolioDashboard),
  {
    ssr: false,
    loading: Ladehinweis,
  },
);

/**
 * Eigene Komponente statt einer Pfeilfunktion in `loading`: `useTranslations`
 * ist ein Hook und braucht eine Komponente, keine beliebige Funktion.
 */
function Ladehinweis() {
  const t = useTranslations();
  return (
    <div className="grid h-96 place-items-center text-sm text-muted-foreground">
      {t("work.dashboard.dashboardWirdGeladen")}
    </div>
  );
}
