"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper fuer den schweren Netzplan (xyflow + dagre = ~200kb gzipped).
 * Server-Components koennen `dynamic({ ssr: false })` nicht direkt nutzen —
 * deshalb der Umweg ueber diese Client-Komponente.
 */
export const CockpitNetworkLazy = dynamic(
  () => import("./cockpit-network").then((m) => m.CockpitNetwork),
  {
    ssr: false,
    loading: NetzplanLadehinweis,
  },
);

/**
 * Eigene Komponente statt einer Pfeilfunktion in `loading`: `useTranslations`
 * ist ein Hook und braucht eine Komponente.
 */
function NetzplanLadehinweis() {
  const t = useTranslations();
  return (
    <div className="grid h-96 place-items-center text-sm text-muted-foreground">
      {t("drumbeat.ui.netzplanWirdGeladen")}
    </div>
  );
}
