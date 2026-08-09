/**
 * Risk matrix — the module's deep, pure business seam. A 5×5
 * probability × impact grid; `score = p·i` (1..25) maps to an exposure band.
 * This one function is the single source of truth for band colour, driving both
 * the list-row exposure badge and the matrix cell tint, so they never diverge.
 */

export const RISK_LEVELS = ["very_low", "low", "medium", "high", "very_high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type Probability = RiskLevel;
export type Impact = RiskLevel;

export function isRiskLevel(s: string): s is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(s);
}

/** Ordinal value 1..5 of each level (drives `score = p·i`). */
export const LEVEL_VALUE: Record<RiskLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

export type ExposureBand = "low" | "medium" | "high" | "critical";

/** Upper-inclusive score cut-offs per band (tunable). `≤4 / ≤9 / ≤15 / else`. */
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

/** Stable cell key for a `(probability, impact)` pair. */
export function cellKey(p: RiskLevel, i: RiskLevel): string {
  return `${p}:${i}`;
}

export interface MatrixCell {
  probability: RiskLevel;
  impact: RiskLevel;
  key: string;
  score: number;
  band: ExposureBand;
}

/** All 25 cells (probability high→low × impact low→high is a rendering concern;
 *  this is just the flat set with their bands for the legend/aggregation). */
export const MATRIX_CELLS: readonly MatrixCell[] = RISK_LEVELS.flatMap((p) =>
  RISK_LEVELS.map((i) => {
    const { score, band } = riskExposure(p, i);
    return { probability: p, impact: i, key: cellKey(p, i), score, band };
  }),
);

// ---------------------------------------------------------------------------
// Positions — inherent + reassessment trail → the multi-hop mitigation vector.
// ---------------------------------------------------------------------------

export interface Scoring {
  probability: RiskLevel;
  impact: RiskLevel;
}

export interface Position {
  probability: RiskLevel;
  impact: RiskLevel;
  key: string;
  score: number;
  band: ExposureBand;
}

export interface RiskPositions {
  /** Assessment #0 — the initial scoring (null when unscored). */
  inherent: Position | null;
  /** inherent → each reassessment, in order (empty when unscored). */
  trail: Position[];
  /** The live position (last trail point, else null when unscored). */
  current: Position | null;
}

function toPosition(p: RiskLevel, i: RiskLevel): Position {
  const { score, band } = riskExposure(p, i);
  return { probability: p, impact: i, key: cellKey(p, i), score, band };
}

/**
 * Resolve a risk's plotting positions. `inherent` is the initial scoring (may be
 * partial/absent → unscored); `assessments` is the ordered reassessment trail.
 * `current` is the latest point and drives the exposure badge + ROAM bucket.
 */
export function riskPositions(
  inherent: { probability?: string | null; impact?: string | null } | null | undefined,
  assessments: readonly Scoring[] = [],
): RiskPositions {
  const inh =
    inherent && isRiskLevel(String(inherent.probability)) && isRiskLevel(String(inherent.impact))
      ? toPosition(inherent.probability as RiskLevel, inherent.impact as RiskLevel)
      : null;
  const trail: Position[] = [];
  if (inh) trail.push(inh);
  for (const a of assessments) trail.push(toPosition(a.probability, a.impact));
  return { inherent: inh, trail, current: trail.length ? trail[trail.length - 1]! : null };
}
