"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper für den Epic-Netzplan (xyflow + dagre) — die Epic-Seite ist
 * eine Server-Komponente und kann `dynamic({ ssr: false })` nicht selbst.
 * Dasselbe Muster wie `CockpitNetworkLazy`.
 */
export const EpicNetworkLazy = dynamic(() => import("./epic-network").then((m) => m.EpicNetwork), {
  ssr: false,
  loading: NetzplanLadehinweis,
});

function NetzplanLadehinweis() {
  const t = useTranslations();
  return (
    <div className="grid h-96 place-items-center text-sm text-muted-foreground">
      {t("drumbeat.ui.netzplanWirdGeladen")}
    </div>
  );
}
