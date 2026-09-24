"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

/**
 * Lazy-Wrapper für den Ziel-Netzplan (`@xyflow/react` + `@dagrejs/dagre` = ~200 kb
 * gzipped). Server-Components können `dynamic({ ssr:false })` nicht direkt nutzen —
 * daher dieser Client-Umweg (analog `umsetzung/cockpit-network-lazy.tsx`). Hält den
 * Netzplan-Chunk aus dem Initial-Bundle der /ziele-Route (nur bei `?layout=netzplan`).
 */
export const StrategyNetworkViewLazy = dynamic(
  () => import("./strategy-network-view").then((m) => m.StrategyNetworkView),
  {
    ssr: false,
    loading: Ladehinweis,
  },
);

/**
 * Eigene Komponente statt einer Pfeilfunktion in `loading`: sie ruft
 * `useTranslations` auf, und ein Hook braucht eine Komponente, keine
 * beliebige Funktion.
 */
function Ladehinweis() {
  const t = useTranslations();
  return (
    <div className="grid h-96 place-items-center text-sm text-muted-foreground">
      {t("goals.network.loading")}
    </div>
  );
}
