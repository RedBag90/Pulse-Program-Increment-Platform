"use client";

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
    loading: () => (
      <div className="grid h-96 place-items-center text-sm text-muted-foreground">
        Netzplan wird geladen…
      </div>
    ),
  },
);
