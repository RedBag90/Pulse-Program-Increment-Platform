import {
  parseBusinessCase,
  computeBusinessCaseTotals,
  type BusinessCaseTotals,
} from "@/domain/business-case";
import { STAGE_GATES, SUB_STAGES, subStageFor, type SubStage } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import { ragTier, type RagTier } from "@/domain/transformation-delta";

/**
 * Portfolio epics list page-model — shapes the loaded Prisma rows into the
 * rich row DTO the master list renders. Replaces the three-column table the
 * old page surfaced (title · value stream · status) with a row that carries
 * everything a portfolio manager needs to decide: economics from the business
 * case, owner label, approval-phase pill data, governance flags, KPI progress,
 * pending-approval count, child feature count. The funnel-counts map and
 * pre-computed filter options live here too so the client shell stays pure
 * URL state.
 */

export interface EpicEconomics {
  implementationCost: number | null;
  oneTimeBenefit: number | null;
  recurringBenefitYear: number | null;
}

export interface EpicListRow {
  id: string;
  title: string;
  stageGate: StageGate;
  /** Derived sub-stage inside L2 / L4 — null elsewhere. UI-only. */
  subStage: SubStage | null;
  /** QS status — orthogonal to approvalPhase. */
  status: string;
  /** Multi-party approval phase pill — null when not yet entered the workflow. */
  approvalPhase: string | null;
  valueStream: { id: string; name: string } | null;
  ownerId: string | null;
  ownerLabel: string | null;
  needsSteeringAttention: boolean;
  stagedForBudgeting: boolean;
  economics: EpicEconomics;
  /** Mean KPI progress (0..1) or null when no KPIs are bound. */
  kpiProgress: number | null;
  kpiTier: RagTier | null;
  kpiCount: number;
  /** Approvals on the active revision that haven't decided yet. */
  pendingApprovalsCount: number;
  childFeatureCount: number;
  /** ISO-day strings (or null). */
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  /** Epoch milliseconds — used by the createdAt sort. */
  createdAtMs: number;
}

export interface EpicsListModel {
  rows: EpicListRow[];
  funnelCounts: Record<StageGate, number>;
  /** Counts pro Sub-Stage (L2.1 / L2.2 / L4.1 / L4.2). Wird im Funnel-Bar
   *  als Mini-Indikator unter L2 und L4 gerendert. */
  subStageCounts: Record<SubStage, number>;
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  statusOptions: string[];
  stageGatesEnabled: boolean;
}

// ---- Input row types ----

interface KpiRow {
  baseline: number | null;
  target: number;
  current: number | null;
}

interface ApprovalRow {
  revision: number;
  status: string;
}

interface EpicRow {
  id: string;
  title: string;
  stageGate: string;
  status: string;
  approvalPhase: string | null;
  approvalRevision: number;
  ownerId: string | null;
  valueStream: { id: string; name: string } | null;
  needsSteeringAttention: boolean;
  stagedForBudgeting: boolean;
  businessCase: unknown;
  /** Stamp set, wenn der BC die vollständige Freigabe abgeschlossen hat —
   *  treibt die Sub-Stage L2.2 in `subStageFor`. */
  businessCaseApprovedAt: Date | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  createdAt: Date;
  /** All bound KPIs (`Kpi` rows on the Epic). */
  kpis: KpiRow[];
  /** All `EpicApproval` rows for the Epic, across revisions. */
  epicApprovals: ApprovalRow[];
  /** Count of child Features (direct only). */
  childFeatureCount: number;
  /** Count of child Features mit status === "completed". Treibt L4.2. */
  completedChildFeatureCount: number;
}

const isoDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Mean KPI progress on [0..1]. Mirrors `goalKpiProgress` from transformation services. */
function meanKpiProgress(kpis: KpiRow[]): number | null {
  if (kpis.length === 0) return null;
  const sum = kpis.reduce((acc, k) => {
    const start = k.baseline ?? 0;
    const denom = k.target - start;
    if (denom === 0) return acc + (k.current != null ? 1 : 0);
    return acc + Math.min(1, Math.max(0, ((k.current ?? start) - start) / denom));
  }, 0);
  return sum / kpis.length;
}

/**
 * Derive the row-level economics. Returns all-null when the business case is
 * empty (a fresh L0 epic) or carries no monetary fields yet; the table shows
 * "—" in that case.
 */
function deriveEconomics(businessCase: unknown): EpicEconomics {
  const parsed = parseBusinessCase(businessCase);
  const fields = parsed.current;
  const totals: BusinessCaseTotals = computeBusinessCaseTotals(fields);
  const hasAny =
    totals.implementationCost > 0 || totals.oneTimeBenefit > 0 || totals.recurringBenefit > 0;
  if (!hasAny) {
    return { implementationCost: null, oneTimeBenefit: null, recurringBenefitYear: null };
  }
  return {
    implementationCost: totals.implementationCost || null,
    oneTimeBenefit: totals.oneTimeBenefit || null,
    recurringBenefitYear: totals.recurringBenefit || null,
  };
}

/**
 * Count pending approvals on the active revision only — earlier revisions are
 * historical noise. Active = `epic.approvalRevision` (bumped each time a new
 * cycle is started); we tally rows whose status is still "pending".
 */
function countPendingApprovals(approvals: ApprovalRow[], activeRevision: number): number {
  return approvals.filter((a) => a.revision === activeRevision && a.status === "pending").length;
}

export function buildEpicsListModel(input: {
  epics: readonly EpicRow[];
  valueStreams: readonly { id: string; name: string }[];
  userLabels: Readonly<Record<string, string>>;
  stageGatesEnabled: boolean;
}): EpicsListModel {
  const { epics, valueStreams, userLabels, stageGatesEnabled } = input;

  const rows: EpicListRow[] = epics.map((e) => {
    const kpiProgress = meanKpiProgress(e.kpis);
    const stageGate = e.stageGate as StageGate;
    return {
      id: e.id,
      title: e.title,
      stageGate,
      subStage: subStageFor({
        stageGate,
        businessCase: e.businessCase,
        businessCaseApprovedAt: e.businessCaseApprovedAt,
        childFeatureStats: {
          total: e.childFeatureCount,
          completed: e.completedChildFeatureCount,
        },
      }),
      status: e.status,
      approvalPhase: e.approvalPhase,
      valueStream: e.valueStream,
      ownerId: e.ownerId,
      ownerLabel: e.ownerId ? (userLabels[e.ownerId] ?? null) : null,
      needsSteeringAttention: e.needsSteeringAttention,
      stagedForBudgeting: e.stagedForBudgeting,
      economics: deriveEconomics(e.businessCase),
      kpiProgress,
      kpiTier: kpiProgress != null ? ragTier(kpiProgress) : null,
      kpiCount: e.kpis.length,
      pendingApprovalsCount: countPendingApprovals(e.epicApprovals, e.approvalRevision),
      childFeatureCount: e.childFeatureCount,
      plannedStartAt: isoDay(e.plannedStartAt),
      plannedEndAt: isoDay(e.plannedEndAt),
      createdAtMs: e.createdAt.getTime(),
    };
  });

  // Funnel counts: every gate present in the constants gets a slot — even an
  // empty gate shows "0" instead of disappearing.
  const funnelCounts = Object.fromEntries(STAGE_GATES.map((g) => [g, 0])) as Record<
    StageGate,
    number
  >;
  const subStageCounts = Object.fromEntries(SUB_STAGES.map((s) => [s, 0])) as Record<
    SubStage,
    number
  >;
  for (const r of rows) {
    if (funnelCounts[r.stageGate] != null) funnelCounts[r.stageGate] += 1;
    if (r.subStage) subStageCounts[r.subStage] += 1;
  }

  // Owner options — distinct ownerIds that actually appear, with their labels.
  const ownerOptionMap = new Map<string, string>();
  for (const r of rows) {
    if (r.ownerId && !ownerOptionMap.has(r.ownerId)) {
      ownerOptionMap.set(r.ownerId, r.ownerLabel ?? r.ownerId);
    }
  }
  const ownerOptions = [...ownerOptionMap].map(([id, label]) => ({ id, label }));

  // Status options — distinct statuses present; the filter chip shows only
  // states that actually appear in the dataset.
  const statusOptions = [...new Set(rows.map((r) => r.status))];

  return {
    rows,
    funnelCounts,
    subStageCounts,
    valueStreamOptions: valueStreams.map((v) => ({ id: v.id, name: v.name })),
    ownerOptions,
    statusOptions,
    stageGatesEnabled,
  };
}
