"use client";

import { useReportWebVitals } from "next/web-vitals";

const GOOD: Record<string, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 800,
};
const NEEDS: Record<string, number> = {
  LCP: 4000,
  INP: 500,
  CLS: 0.25,
  FCP: 3000,
  TTFB: 1800,
};

function rating(name: string, value: number): "good" | "ni" | "poor" {
  const g = GOOD[name];
  const n = NEEDS[name];
  if (g === undefined || n === undefined) return "good";
  if (value <= g) return "good";
  if (value <= n) return "ni";
  return "poor";
}

/**
 * Loggt Core Web Vitals in die Browser-Konsole (nur Dev). Reine
 * Diagnose — keine Telemetrie-Sink. Farbe nach Schwellenwert
 * (good/needs-improvement/poor) damit Regressions sofort sichtbar sind.
 */
export function WebVitalsReporter() {
  useReportWebVitals((m) => {
    if (process.env.NODE_ENV !== "development") return;
    const r = rating(m.name, m.value);
    const color = r === "good" ? "color:#10b981" : r === "ni" ? "color:#f59e0b" : "color:#ef4444";
    const display = m.name === "CLS" ? m.value.toFixed(3) : `${Math.round(m.value)}ms`;
    // eslint-disable-next-line no-console
    console.log(`%c[web-vitals] ${m.name} = ${display} (${r})`, color, {
      id: m.id,
      delta: m.delta,
      navigationType: m.navigationType,
    });
  });
  return null;
}
