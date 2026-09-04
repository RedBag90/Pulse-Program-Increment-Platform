"use client";

import { useEffect, useState } from "react";

/**
 * Das **Portfolio-Limit** je Wertstrom, für Flächen, die es benennen, bevor ein
 * Epic existiert.
 *
 * Eigener Hook statt `useEntityOptions`, weil die Antwort kein Listen-, sondern
 * ein Objekt ist: die Schwellen je Wertstrom **und** der Wert, der gilt,
 * solange keiner gewählt ist. Beides in eine Liste zu pressen hieße, den
 * Default als Pseudo-Zeile zu schmuggeln.
 *
 * Scheitert der Abruf, bleibt `null` — der Aufrufer zeigt dann seine Labels
 * ohne Zahl. Lieber keine Zahl als eine falsche.
 */
export interface PortfolioThresholds {
  defaultThreshold: number;
  byValueStream: Record<string, number>;
}

export function usePortfolioThresholds(enabled: boolean): PortfolioThresholds | null {
  const [data, setData] = useState<PortfolioThresholds | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    fetch("/api/v1/portfolio/guardrail-thresholds", { headers: { accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const t = json as Partial<PortfolioThresholds> | null;
        if (t == null || typeof t.defaultThreshold !== "number") return;
        setData({
          defaultThreshold: t.defaultThreshold,
          byValueStream: t.byValueStream ?? {},
        });
      })
      .catch(() => {
        // Still: die Fläche zeigt dann die schlichten Labels.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}
