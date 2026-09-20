/**
 * **Exposure** — `Eintrittswahrscheinlichkeit × Auswirkung` auf einem 5×5-Raster,
 * `score = p·i` (1…25), abgebildet auf vier Bänder (ADR-0016).
 *
 * Liegt in Core **aus demselben Grund wie ROAM** (`roam.ts`): mehrere Module
 * sprechen darüber. Das Risiko-Modul rechnet damit, die Portfolio-Übersicht in
 * `work` zeigt dieselben Bänder an ihren Risiko-Zeilen, und die Wiki-Figur
 * erklärt sie. Solange die Skala in `risks` lag, verbot ADR-0013 den Import und
 * jede Fläche baute sie nach — mit **drei verschiedenen Farbskalen** für
 * dieselbe Größe (`slate/amber/orange/rose` gegen `emerald/amber/orange/red`).
 * Eine Größe, ein Ort.
 *
 * Wie bei ROAM trägt die Datei auch die **kanonische Palette**: eine Farbtabelle
 * je Achse, gelesen von jeder Fläche, statt einer Tabelle je Fläche.
 *
 * Rein, kein I/O.
 */

export const RISK_LEVELS = ["very_low", "low", "medium", "high", "very_high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type Probability = RiskLevel;
export type Impact = RiskLevel;

export function isRiskLevel(s: string): s is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(s);
}

/** Ordinalwert 1…5 je Stufe (treibt `score = p·i`). */
export const LEVEL_VALUE: Record<RiskLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

export type ExposureBand = "low" | "medium" | "high" | "critical";

/** Bänder nach Schwere geordnet (low → critical) — zugleich die Sortier-Ordnung. */
export const EXPOSURE_BANDS: readonly ExposureBand[] = ["low", "medium", "high", "critical"];

export function exposureRank(band: ExposureBand | null | undefined): number {
  return band ? EXPOSURE_BANDS.indexOf(band) + 1 : 0;
}

/** Obere (einschließende) Score-Grenzen je Band: `≤4 / ≤9 / ≤15 / sonst` (ADR-0016). */
export const BAND_THRESHOLDS: readonly { max: number; band: ExposureBand }[] = [
  { max: 4, band: "low" },
  { max: 9, band: "medium" },
  { max: 15, band: "high" },
  { max: 25, band: "critical" },
];

export function bandForScore(score: number): ExposureBand {
  for (const t of BAND_THRESHOLDS) if (score <= t.max) return t.band;
  return "critical";
}

export interface Exposure {
  score: number;
  band: ExposureBand;
}

export function riskExposure(p: RiskLevel, i: RiskLevel): Exposure {
  const score = LEVEL_VALUE[p] * LEVEL_VALUE[i];
  return { score, band: bandForScore(score) };
}

export const EXPOSURE_LABEL: Record<ExposureBand, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

/** Die Stufen der beiden Achsen, ausgeschrieben. */
export const LEVEL_LABEL: Record<RiskLevel, string> = {
  very_low: "Sehr niedrig",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  very_high: "Sehr hoch",
};

/**
 * **Die eine Farbtabelle je Band.**
 *
 * Bis September 2026 standen vier parallele Maps nebeneinander
 * (`EXPOSURE_CLASS` · `EXPOSURE_DOT` · `EXPOSURE_HEX` · `EXPOSURE_CELL`) — mit
 * unterschiedlichen Stufen (100 gegen 200) und einer davon ohne Aufrufer. Ein
 * Eintrag je Band, drei Träger:
 *
 * - `badge` — Pille mit Text (Liste, Detail). Warme Skala, bewusst disjunkt von
 *   der kühlen ROAM-Palette (`roam.ts`): Farbe sagt hier Kritikalität, dort
 *   Disposition, und die beiden dürfen sich nie überlagern.
 * - `cell` — die weiche Tönung der Matrixzelle; nach oben etwas kräftiger, damit
 *   die oberen Bänder auch mit Punkten darauf noch als Heat lesbar sind.
 * - `hex` — Rohwert für `style`-Farben (Filter-Punkt, SVG).
 */
export const EXPOSURE_TONE: Record<ExposureBand, { badge: string; cell: string; hex: string }> = {
  low: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    cell: "bg-emerald-100 dark:bg-emerald-950/40",
    hex: "#10b981",
  },
  medium: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    cell: "bg-amber-100 dark:bg-amber-950/40",
    hex: "#f59e0b",
  },
  high: {
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
    cell: "bg-orange-200 dark:bg-orange-950/50",
    hex: "#f97316",
  },
  critical: {
    badge: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    cell: "bg-red-200 dark:bg-red-950/60",
    hex: "#ef4444",
  },
};
