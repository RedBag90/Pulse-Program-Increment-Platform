import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
  type BusinessCaseTotals,
} from "@/modules/work/domain/business-case";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
} from "@/modules/work/domain/benefit-hypothesis";
import { epicNextStep, type EpicNextStep } from "@/modules/work/domain/epic-next-step";
import { epicBenefitFromKpis } from "@/modules/work/domain/epic-economics";
import { kpiFulfillmentMean } from "@/modules/core/kpi/domain/kpi-valuation";
import {
  STAGE_GATES,
  SUB_STAGES,
  subStageFor,
  type GateStep,
  type SubStage,
} from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { ragTier, type RagTier } from "@/modules/work/domain/transformation-delta";
import { extractUniqueFacet } from "@/server/views/lib/page-model-utils";

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
  /** Nächster notwendiger Schritt (Reifegrad-Guidance) — null bei L5/fertig. */
  nextStep: EpicNextStep | null;
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
  /**
   * Offener Reifegrad-Antrag, falls einer läuft — ersetzt die früheren zwei
   * Bucket-Abweichungen: statt die Karte still in eine andere Spalte zu
   * schieben, steht das Epic da, wo es steht, und trägt daneben „⇧ L3 · 1/2".
   */
  pendingGateRequest: { toGate: GateStep; pendingCount: number; totalCount: number } | null;
  childFeatureCount: number;
  /** ISO-day strings (or null). */
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  /** Epoch milliseconds — used by the createdAt sort. */
  createdAtMs: number;
  /** SAFe-Guardrails (Roadmap-G3): Solution/Epic/Enabler. */
  epicType: string | null;
  /** SAFe-Guardrails (Roadmap-G3): H1/H2/H3. */
  investmentHorizon: string | null;
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
  /** KPI-Wertung — treibt den abgeleiteten Business-Case-Nutzen. */
  valuePerUnit: number | null;
  benefitKind: string;
  recurringInterval: string;
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
  /** Benefit-Hypothese-Dokument — treibt `hasHypothesis` im Nächster-Schritt.
   *  Optional: fehlt es (z. B. Test-Fixture), gilt „keine Hypothese". */
  benefitHypothesis?: unknown;
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
  /** Offener Gate-Antrag des Epics, vom Loader aufgelöst. */
  pendingGateRequest?: { toGate: GateStep; pendingCount: number; totalCount: number } | null;
  /** Count of child Features (direct only). */
  childFeatureCount: number;
  /** Count of child Features mit status === "completed" — Voraussetzung des L4.2-Antrags. */
  completedChildFeatureCount: number;
  /** Stempel der abgenommenen L4.2-Bestätigung („Umsetzung fertig"). */
  implementationCompletedAt: Date | null;
  /** SAFe-Guardrails (Roadmap-G3). */
  epicType: string | null;
  investmentHorizon: string | null;
}

const isoDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Mean KPI attainment on [0..1] via Core `kpiFulfillmentMean` — KPIs without a
 * current reading (or a zero-width band) are excluded, not counted as 0 %.
 */
function meanKpiProgress(kpis: KpiRow[]): number | null {
  return kpiFulfillmentMean(
    kpis.map((k) => ({ baseline: k.baseline, target: k.target, current: k.current })),
  );
}

/**
 * Derive the row-level economics. Returns all-null when the business case is
 * empty (a fresh L0 epic) or carries no monetary fields yet; the table shows
 * "—" in that case.
 */
function deriveEconomics(businessCase: unknown, kpis: KpiRow[]): EpicEconomics {
  const parsed = parseBusinessCase(businessCase);
  const fields = parsed.current;
  // Nutzen kommt direkt aus den KPIs (100 %-Zielerreichung), Kosten aus dem BC.
  const totals: BusinessCaseTotals = computeBusinessCaseTotals(fields, epicBenefitFromKpis(kpis));
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
    const childFeatureStats = {
      total: e.childFeatureCount,
      completed: e.completedChildFeatureCount,
    };
    const subStage = subStageFor({
      stageGate,
      businessCase: e.businessCase,
      businessCaseApprovedAt: e.businessCaseApprovedAt,
      implementationCompletedAt: e.implementationCompletedAt,
    });
    // Nächster-Schritt-Guidance — dieselbe reine Logik wie die Detailseite.
    // `budgetAllocated`/`impactRecognizedAt` sind hier nicht per Row geladen:
    // Erstes beeinflusst nur eine L3-Hinweis-Nuance, Zweites ist bei L5 ohnehin
    // terminal (epicNextStep gibt dort null).
    const nextStep = epicNextStep({
      epicId: e.id,
      stageGate,
      subStage,
      approvalPhase: e.approvalPhase,
      hasHypothesis: benefitHypothesisHasContent(
        parseBenefitHypothesis(e.benefitHypothesis).current,
      ),
      hasBusinessCase: businessCaseHasContent(parseBusinessCase(e.businessCase).current),
      budgetAllocated: false,
      impactRecognizedAt: null,
      childFeatureStats,
    });
    return {
      id: e.id,
      title: e.title,
      stageGate,
      subStage,
      nextStep,
      status: e.status,
      approvalPhase: e.approvalPhase,
      valueStream: e.valueStream,
      ownerId: e.ownerId,
      ownerLabel: e.ownerId ? (userLabels[e.ownerId] ?? null) : null,
      needsSteeringAttention: e.needsSteeringAttention,
      stagedForBudgeting: e.stagedForBudgeting,
      economics: deriveEconomics(e.businessCase, e.kpis),
      kpiProgress,
      kpiTier: kpiProgress != null ? ragTier(kpiProgress) : null,
      kpiCount: e.kpis.length,
      pendingApprovalsCount: countPendingApprovals(e.epicApprovals, e.approvalRevision),
      pendingGateRequest: e.pendingGateRequest ?? null,
      childFeatureCount: e.childFeatureCount,
      plannedStartAt: isoDay(e.plannedStartAt),
      plannedEndAt: isoDay(e.plannedEndAt),
      createdAtMs: e.createdAt.getTime(),
      epicType: e.epicType,
      investmentHorizon: e.investmentHorizon,
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
  // Gezählt wird direkt nach `stageGate`. Die frühere Bucket-Abweichung ist mit
  // dem manuellen Wechsel entfallen (siehe `domain/stage-gate.ts`).
  for (const r of rows) {
    if (funnelCounts[r.stageGate] != null) funnelCounts[r.stageGate] += 1;
    if (r.subStage) subStageCounts[r.subStage] += 1;
  }

  // Owner options — distinct ownerIds that actually appear, with their labels.
  const ownerOptions = extractUniqueFacet(
    rows,
    (r) => r.ownerId,
    (r, id) => r.ownerLabel ?? id,
  );

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
