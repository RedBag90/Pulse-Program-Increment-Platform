import {
  riskPositions,
  cellKey,
  MATRIX_CELLS,
  type ExposureBand,
  type RiskLevel,
} from "@/modules/risks/domain/risk-matrix";
import { formatRiskNumber } from "@/modules/risks/domain/risk-number";
import { buildFunnelCounts, extractUniqueFacet } from "@/server/views/lib/page-model-utils";
import { ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";

// ── Loose input rows (the loader maps Prisma rows into these; keeps the builder
//    DB-free and testable). ──────────────────────────────────────────────────
export interface RiskAssessmentRow {
  probability: string;
  impact: string;
  createdAt: Date;
}
export interface RiskRow {
  id: string;
  riskNumber: number | null;
  title: string;
  description: string | null;
  probability: string | null;
  impact: string | null;
  category: string | null;
  targetResolutionDate: Date | null;
  reviewStatus: string;
  roamStatus: string;
  ownerId: string | null;
  raisedBy: string;
  createdAt: Date;
  assessments: readonly RiskAssessmentRow[];
  epicLinks: readonly { epicId: string }[];
  mitigations: readonly { id: string }[];
}

// ── Output ────────────────────────────────────────────────────────────────────
export interface RiskListRow {
  id: string;
  displayNumber: string | null;
  title: string;
  description: string | null;
  reviewStatus: string;
  roamStatus: string;
  category: string | null;
  ownerId: string | null;
  ownerLabel: string | null;
  targetResolutionDate: string | null;
  isOverdue: boolean;
  band: ExposureBand | null;
  epicCount: number;
  mitigationCount: number;
}

export interface MatrixPlot {
  riskId: string;
  displayNumber: string | null;
  roamStatus: string;
  /** inherent → each reassessment → current (empty when unscored). */
  trail: { probability: RiskLevel; impact: RiskLevel }[];
}
export interface MatrixCellCount {
  probability: RiskLevel;
  impact: RiskLevel;
  key: string;
  band: ExposureBand;
  count: number;
}

export interface RisksListModel {
  rows: RiskListRow[];
  suggestions: RiskListRow[];
  unscored: RiskListRow[];
  roamFunnel: Record<RoamStatus, number>;
  matrix: { cells: MatrixCellCount[]; plots: MatrixPlot[] };
  facets: {
    categories: string[];
    owners: { id: string; label: string }[];
  };
}

function toDisplayNumber(prefix: string, n: number | null): string | null {
  return n == null ? null : formatRiskNumber(prefix, n);
}

export function buildRisksListModel(input: {
  risks: readonly RiskRow[];
  prefix: string;
  userLabels: Readonly<Record<string, string>>;
  now?: Date;
}): RisksListModel {
  const { risks, prefix, userLabels } = input;
  const nowMs = (input.now ?? new Date()).getTime();

  const positionsOf = (r: RiskRow) =>
    riskPositions(
      { probability: r.probability, impact: r.impact },
      r.assessments.map((a) => ({
        probability: a.probability as RiskLevel,
        impact: a.impact as RiskLevel,
      })),
    );

  const toListRow = (r: RiskRow): RiskListRow => {
    const pos = positionsOf(r);
    const overdue =
      r.targetResolutionDate != null &&
      r.targetResolutionDate.getTime() < nowMs &&
      r.roamStatus !== "resolved";
    return {
      id: r.id,
      displayNumber: toDisplayNumber(prefix, r.riskNumber),
      title: r.title,
      description: r.description,
      reviewStatus: r.reviewStatus,
      roamStatus: r.roamStatus,
      category: r.category,
      ownerId: r.ownerId,
      ownerLabel: r.ownerId ? (userLabels[r.ownerId] ?? null) : null,
      targetResolutionDate: r.targetResolutionDate?.toISOString() ?? null,
      isOverdue: overdue,
      band: pos.current?.band ?? null,
      epicCount: r.epicLinks.length,
      mitigationCount: r.mitigations.length,
    };
  };

  const documented = risks.filter((r) => r.reviewStatus === "documented");
  const suggested = risks.filter((r) => r.reviewStatus === "suggested");

  const rows = documented.map(toListRow);
  const suggestions = suggested.map(toListRow);
  const unscored = documented.filter((r) => positionsOf(r).current == null).map(toListRow);

  // ROAM funnel over documented risks.
  const roamFunnel = buildFunnelCounts(documented, ROAM_STATUSES, (r) =>
    (ROAM_STATUSES as readonly string[]).includes(r.roamStatus)
      ? (r.roamStatus as RoamStatus)
      : "open",
  );

  // Matrix — cells (counts of current positions) + per-risk plots (the trail).
  const currentCounts = new Map<string, number>();
  const plots: MatrixPlot[] = [];
  for (const r of documented) {
    const pos = positionsOf(r);
    if (!pos.current) continue;
    currentCounts.set(pos.current.key, (currentCounts.get(pos.current.key) ?? 0) + 1);
    plots.push({
      riskId: r.id,
      displayNumber: toDisplayNumber(prefix, r.riskNumber),
      roamStatus: r.roamStatus,
      trail: pos.trail.map((p) => ({ probability: p.probability, impact: p.impact })),
    });
  }
  const cells: MatrixCellCount[] = MATRIX_CELLS.map((c) => ({
    probability: c.probability,
    impact: c.impact,
    key: c.key,
    band: c.band,
    count: currentCounts.get(cellKey(c.probability, c.impact)) ?? 0,
  }));

  const categories = extractUniqueFacet(
    risks,
    (r) => r.category,
    (_r, id) => id,
  ).map((c) => c.id);
  const owners = extractUniqueFacet(
    risks,
    (r) => r.ownerId,
    (_r, id) => userLabels[id] ?? id,
  );

  return {
    rows,
    suggestions,
    unscored,
    roamFunnel,
    matrix: { cells, plots },
    facets: { categories, owners },
  };
}
