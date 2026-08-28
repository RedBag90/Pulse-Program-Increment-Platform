/**
 * Unified Issue list page-model (single type = risk model). An Issue carries one
 * assessment axis (probability×impact → exposure `band`) + ROAM, and nests under a
 * head-issue via `parentId`. Head rows carry a subtree rollup. The builder stays
 * DB-free (loader maps Prisma rows into the loose input rows) so it is testable.
 */
import {
  riskPositions,
  cellKey,
  MATRIX_CELLS,
  type ExposureBand,
  type RiskLevel,
} from "@/modules/risks/domain/risk-matrix";
import { formatRiskNumber } from "@/modules/risks/domain/risk-number";
import { buildFunnelCounts, extractUniqueFacet } from "@/server/views/lib/page-model-utils";
import { diffInDays } from "@/modules/core/kernel/domain/calendar";
import {
  ROAM_STATUSES,
  normalizeRoamStatus,
  type RoamStatus,
} from "@/modules/core/kernel/domain/roam";
import { rollupIssueSubtrees, type RollupNode } from "@/modules/risks/domain/issue-subtree-rollup";

// ── Loose input rows (the loader maps Prisma rows into these) ──────────────────
export interface IssueAssessmentRow {
  probability: string;
  impact: string;
  createdAt: Date;
  note?: string | null;
}
export interface IssueMitigationRow {
  id: string;
  description: string;
}
export interface IssueInitiativeRef {
  id: string;
  title: string;
  level: number;
  parentId: string | null;
}
export interface IssueRow {
  id: string;
  issueNumber: number | null;
  title: string;
  description: string | null;
  probability: string | null;
  impact: string | null;
  category: string | null;
  reviewStatus: string;
  roamStatus: string;
  roamRationale: string | null;
  ownerId: string | null;
  raisedBy: string | null;
  targetResolutionDate: Date | null;
  createdAt: Date;
  parentId: string | null;
  initiativeId: string | null;
  assessments: readonly IssueAssessmentRow[];
  mitigations: readonly IssueMitigationRow[];
  initiative: IssueInitiativeRef | null;
  /** ART-Relation (für Wertstrom-/ART-Filter). Optional — Alt-Fixtures ohne `art`
   *  bleiben gültig; der Loader lädt sie über `ISSUE_LIST_INCLUDE`. */
  art?: {
    id: string;
    name: string;
    valueStreamId: string | null;
    valueStream: { name: string } | null;
  } | null;
}

/** Subtree rollup surfaced on head rows (issues that have children). */
export interface IssueRollup {
  roamCounts: Record<RoamStatus, number>;
  spannedEpics: number;
  descendantCount: number;
}

// ── Output ─────────────────────────────────────────────────────────────────────
export interface IssueListRow {
  id: string;
  displayNumber: string | null;
  title: string;
  description: string | null;
  reviewStatus: string;
  roamStatus: string;
  roamRationale: string | null;
  category: string | null;
  probability: string | null;
  impact: string | null;
  band: ExposureBand | null;
  ownerId: string | null;
  ownerLabel: string | null;
  /** Wertstrom/ART (aus der ART-Relation) — für Filter + Anzeige. */
  artId: string | null;
  artName: string | null;
  valueStreamId: string | null;
  valueStreamName: string | null;
  targetResolutionDate: string | null;
  isOverdue: boolean;
  daysOpen: number;
  /** Head-issue nesting. */
  parentId: string | null;
  /** Non-null on head rows (issues with children): subtree rollup. */
  rollup: IssueRollup | null;
  // Work item (feature/epic).
  initiative: IssueInitiativeRef | null;
  mitigations: { id: string; description: string }[];
  assessments: { probability: string; impact: string; createdAt: string; note: string | null }[];
  mitigationCount: number;
}

export interface MatrixPlot {
  issueId: string;
  displayNumber: string | null;
  title: string;
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

export interface IssuesListModel {
  /** Documented issues (the register tree). */
  rows: IssueListRow[];
  /** Issues still under review (reviewStatus="suggested"). */
  suggestions: IssueListRow[];
  /** Documented issues without a current position (need scoring). */
  unscored: IssueListRow[];
  roamFunnel: Record<RoamStatus, number>;
  /** Matrix (cells + per-issue plots). Children collapse into their head (only
   *  parentId==null issues are plotted). */
  matrix: { cells: MatrixCellCount[]; plots: MatrixPlot[] };
  facets: {
    categories: string[];
    owners: { id: string; label: string }[];
    arts: { id: string; label: string }[];
    valueStreams: { id: string; label: string }[];
  };
  counts: { total: number };
}

function toDisplayNumber(prefix: string, n: number | null): string | null {
  return n == null ? null : formatRiskNumber(prefix, n);
}

/** Owning Epic of an issue: the work item itself when it's an Epic (level 0), else
 *  its parent Epic. */
function owningEpicId(init: IssueInitiativeRef | null): string | null {
  if (!init) return null;
  return init.level === 0 ? init.id : init.parentId;
}

export function buildIssuesListModel(input: {
  issues: readonly IssueRow[];
  prefix: string;
  userLabels: Readonly<Record<string, string>>;
  now?: Date;
}): IssuesListModel {
  const { issues, prefix, userLabels } = input;
  const nowMs = (input.now ?? new Date()).getTime();

  const positionsOf = (r: IssueRow) =>
    riskPositions(
      { probability: r.probability, impact: r.impact },
      r.assessments.map((a) => ({
        probability: a.probability as RiskLevel,
        impact: a.impact as RiskLevel,
      })),
    );

  const labelFor = (id: string | null): string | null => (id ? (userLabels[id] ?? null) : null);

  const documented = issues.filter((r) => r.reviewStatus === "documented");
  const suggested = issues.filter((r) => r.reviewStatus === "suggested");

  // Subtree rollup over documented rows; heads = ids that are some row's parent.
  const rollupNodes: RollupNode[] = documented.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    roamStatus: r.roamStatus,
    epicId: owningEpicId(r.initiative),
  }));
  const rollupMap = rollupIssueSubtrees(rollupNodes);
  const hasChildren = new Set(documented.map((r) => r.parentId).filter((p): p is string => !!p));

  const toListRow = (r: IssueRow): IssueListRow => {
    const pos = positionsOf(r);
    const overdue =
      r.targetResolutionDate != null &&
      r.targetResolutionDate.getTime() < nowMs &&
      r.roamStatus !== "resolved";
    const rid = rollupMap.get(r.id);
    const rollup: IssueRollup | null =
      hasChildren.has(r.id) && rid
        ? {
            roamCounts: rid.roamCounts,
            spannedEpics: rid.spannedEpicIds.length,
            descendantCount: rid.descendantCount,
          }
        : null;
    return {
      id: r.id,
      displayNumber: toDisplayNumber(prefix, r.issueNumber),
      title: r.title,
      description: r.description,
      reviewStatus: r.reviewStatus,
      roamStatus: r.roamStatus,
      roamRationale: r.roamRationale,
      category: r.category,
      probability: r.probability,
      impact: r.impact,
      band: pos.current?.band ?? null,
      ownerId: r.ownerId,
      ownerLabel: labelFor(r.ownerId),
      artId: r.art?.id ?? null,
      artName: r.art?.name ?? null,
      valueStreamId: r.art?.valueStreamId ?? null,
      valueStreamName: r.art?.valueStream?.name ?? null,
      targetResolutionDate: r.targetResolutionDate?.toISOString() ?? null,
      isOverdue: overdue,
      daysOpen: diffInDays(nowMs, r.createdAt.getTime()),
      parentId: r.parentId,
      rollup,
      initiative: r.initiative,
      mitigations: r.mitigations.map((m) => ({ id: m.id, description: m.description })),
      assessments: r.assessments.map((a) => ({
        probability: a.probability,
        impact: a.impact,
        createdAt: a.createdAt.toISOString(),
        note: a.note ?? null,
      })),
      mitigationCount: r.mitigations.length,
    };
  };

  const rows = documented.map(toListRow);
  const suggestions = suggested.map(toListRow);
  const unscored = documented.filter((r) => positionsOf(r).current == null).map(toListRow);

  const roamFunnel = buildFunnelCounts(documented, ROAM_STATUSES, (r) =>
    normalizeRoamStatus(r.roamStatus),
  );

  // Matrix — scope-effektive Wurzeln (wie `buildIssueTree` für die Tabelle): ein
  // Issue plottet, wenn es keinen Parent IM GELADENEN SET hat. So erscheinen im
  // Epic-Subtree auch Issues, deren Head außerhalb liegt (sonst fehlt die Matrix);
  // Kinder eines sichtbaren Heads collapsen weiterhin in diesen.
  const documentedIds = new Set(documented.map((r) => r.id));
  const currentCounts = new Map<string, number>();
  const plots: MatrixPlot[] = [];
  for (const r of documented) {
    if (r.parentId && documentedIds.has(r.parentId)) continue; // Kind eines sichtbaren Heads
    const pos = positionsOf(r);
    if (!pos.current) continue;
    currentCounts.set(pos.current.key, (currentCounts.get(pos.current.key) ?? 0) + 1);
    plots.push({
      issueId: r.id,
      displayNumber: toDisplayNumber(prefix, r.issueNumber),
      title: r.title,
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
    issues,
    (r) => r.category,
    (_r, id) => id,
  ).map((c) => c.id);
  const owners = extractUniqueFacet(
    issues,
    (r) => r.ownerId,
    (_r, id) => userLabels[id] ?? id,
  );
  const arts = extractUniqueFacet(
    issues,
    (r) => r.art?.id ?? null,
    (r, id) => r.art?.name ?? id,
  );
  const valueStreams = extractUniqueFacet(
    issues,
    (r) => r.art?.valueStreamId ?? null,
    (r, id) => r.art?.valueStream?.name ?? id,
  );

  return {
    rows,
    suggestions,
    unscored,
    roamFunnel,
    matrix: { cells, plots },
    facets: { categories, owners, arts, valueStreams },
    counts: { total: documented.length },
  };
}
