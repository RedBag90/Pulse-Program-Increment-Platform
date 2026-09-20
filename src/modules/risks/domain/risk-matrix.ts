/**
 * Risk matrix — das Raster, auf dem die Bewertung eines Issues sitzt.
 *
 * **Die Skala selbst liegt im Kernel** (`core/kernel/domain/exposure.ts`): sie
 * ist keine Eigenheit dieses Moduls, sondern ein geteiltes Vokabular — die
 * Portfolio-Übersicht in `work` zeigt dieselben Bänder, und ADR-0013 verbietet
 * ihr den Weg hierher. Hier bleibt, was nur die Matrix braucht: der Zellschlüssel,
 * die 25 Felder und der Bewertungs-Pfad eines Issues (inherent → Neubewertungen).
 *
 * Die Skala wird **weitergereicht**, damit die vierzehn vorhandenen Importe aus
 * diesem Modul nichts merken.
 */

export {
  RISK_LEVELS,
  isRiskLevel,
  LEVEL_VALUE,
  EXPOSURE_BANDS,
  exposureRank,
  BAND_THRESHOLDS,
  bandForScore,
  riskExposure,
  EXPOSURE_LABEL,
  LEVEL_LABEL,
  EXPOSURE_TONE,
  type RiskLevel,
  type Probability,
  type Impact,
  type ExposureBand,
  type Exposure,
} from "@/modules/core/kernel/domain/exposure";

import {
  isRiskLevel,
  RISK_LEVELS,
  riskExposure,
  type ExposureBand,
  type RiskLevel,
} from "@/modules/core/kernel/domain/exposure";

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
