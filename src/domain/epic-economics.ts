/**
 * Epic Economics read-model — given one Epic's raw artefacts, derives the single
 * economic view both the Portfolio Dashboard and Participatory Budgeting build
 * on: the parsed Business Case, its cost slices and totals, the resolved
 * schedule anchors (costStart / goLive, via the Epic Schedule module) and the
 * KPIs that realise the recurring benefit with their resolved weights.
 *
 * Pure. The caller loads the Epic row and normalises Prisma `Decimal`s / JSON to
 * the plain inputs below; this module owns the derivation so the two consumers
 * stay consistent — in particular the KPI weight fallback, which used to live
 * only in the dashboard.
 */

import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
  type BusinessCaseFields,
  type BusinessCaseTotals,
} from "@/domain/business-case";
import { parseTimeline } from "@/domain/timeline";
import { resolveCostStart, resolveGoLive } from "@/domain/epic-schedule";
import type { KpiMeasurement } from "@/domain/kpi";

/** A KPI as the read-model needs it — Prisma `Decimal`s already converted. */
export interface EpicEconomicsKpiInput {
  id: string;
  name: string;
  baseline: number | null;
  target: number | null;
  measurements: KpiMeasurement[];
  /** The KPI's own share of the recurring benefit (fraction 0..1), or null. */
  benefitWeight: number | null;
}

/** The raw per-Epic facts the read-model derives from (post-normalisation). */
export interface EpicEconomicsSource {
  /** Stored `businessCase` JSON (versioned or legacy — `parseBusinessCase` handles both). */
  businessCase: unknown;
  /** Stored `timeline` JSON. */
  timeline: unknown;
  businessCaseApprovedAt: Date | null;
  hypothesisApprovedAt: Date | null;
  createdAt: Date;
  /** Linked KPIs; pass `[]` when the consumer does not load them. */
  kpis: EpicEconomicsKpiInput[];
}

/** A KPI with its resolved share of the recurring benefit. */
export interface BenefitKpi {
  kpiId: string;
  name: string;
  weight: number;
  baseline: number | null;
  target: number | null;
  measurements: KpiMeasurement[];
}

export interface EpicEconomicsView {
  businessCase: BusinessCaseFields;
  hasBusinessCase: boolean;
  /** 6-month cost slice amounts (0 for empty slices). */
  costSlices: number[];
  oneTimeBenefit: number;
  recurringBenefit: number;
  totals: BusinessCaseTotals;
  /** Backlog milestone — when cost begins. */
  costStart: Date;
  /** Implementation milestone — completion / go-live. */
  goLive: Date;
  /** Linked KPIs with resolved weights; empty → flat-forecast fallback. */
  benefitKpis: BenefitKpi[];
}

/**
 * Resolves each KPI's share of the recurring benefit:
 *  - some KPI carries a weight → use the weights literally (unweighted = 0);
 *  - none weighted but KPIs exist → split equally (one KPI → 100 %);
 *  - no KPIs → empty (the dashboard's flat-forecast fallback).
 */
export function resolveBenefitWeights(kpis: EpicEconomicsKpiInput[]): BenefitKpi[] {
  const toKpi = (k: EpicEconomicsKpiInput, weight: number): BenefitKpi => ({
    kpiId: k.id,
    name: k.name,
    weight,
    baseline: k.baseline,
    target: k.target,
    measurements: k.measurements,
  });
  if (kpis.some((k) => k.benefitWeight !== null)) {
    return kpis.map((k) => toKpi(k, k.benefitWeight ?? 0));
  }
  if (kpis.length > 0) {
    const equal = 1 / kpis.length;
    return kpis.map((k) => toKpi(k, equal));
  }
  return [];
}

/** Derives the shared economic view for one Epic. */
export function deriveEpicEconomics(source: EpicEconomicsSource): EpicEconomicsView {
  const businessCase = parseBusinessCase(source.businessCase).current;
  const timeline = parseTimeline(source.timeline);
  const costSlices = (businessCase.costSlices ?? []).map((s) => s.amount ?? 0);
  const costStart = resolveCostStart({
    timeline,
    businessCaseApprovedAt: source.businessCaseApprovedAt,
    hypothesisApprovedAt: source.hypothesisApprovedAt,
    createdAt: source.createdAt,
  });
  const goLive = resolveGoLive(timeline, costStart, costSlices.length);
  return {
    businessCase,
    hasBusinessCase: businessCaseHasContent(businessCase),
    costSlices,
    oneTimeBenefit: businessCase.oneTimeBenefit ?? 0,
    recurringBenefit: businessCase.recurringBenefit ?? 0,
    totals: computeBusinessCaseTotals(businessCase),
    costStart,
    goLive,
    benefitKpis: resolveBenefitWeights(source.kpis),
  };
}
