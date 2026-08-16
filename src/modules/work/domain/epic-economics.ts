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
} from "@/modules/work/domain/business-case";
import { parseTimeline } from "@/modules/work/domain/timeline";
import { resolveCostStart, resolveGoLive } from "@/modules/work/domain/epic-schedule";
import type { KpiMeasurement } from "@/modules/core/kpi/domain/kpi";
import { benefitKindOrDefault } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { kpiPlanned } from "@/modules/core/kpi/domain/kpi-valuation";

/** A KPI as the read-model needs it — Prisma `Decimal`s already converted. */
export interface EpicEconomicsKpiInput {
  id: string;
  name: string;
  baseline: number | null;
  target: number | null;
  measurements: KpiMeasurement[];
  /** The KPI's own share of the recurring benefit (fraction 0..1), or null. */
  benefitWeight: number | null;
  /** €-Wert je Einheit Verbesserung baseline→target (KPI-Wertung). */
  valuePerUnit: number | null;
  /** Benefit-Art: "one_time" | "recurring" (src/domain/kpi-benefit-kind.ts). */
  benefitKind: string;
  /** Bei recurring: "monthly" | "yearly" (src/domain/kpi-recurring-interval.ts). */
  recurringInterval: string;
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
  /** €-Wert je Einheit (für die KPI-Wertungs-basierte Benefit-Velocity). */
  valuePerUnit: number | null;
  /** Benefit-Art: "one_time" | "recurring" — partitioniert Einmal vs. Run-Rate. */
  benefitKind: string;
  /** Bei recurring: "monthly" | "yearly" — Intervall des Run-Rate-Werts. */
  recurringInterval: string;
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

/** €-Nutzen eines Epics bei 100 % KPI-Zielerreichung, aus den KPIs abgeleitet. */
export interface EpicBenefit {
  oneTimeBenefit: number;
  recurringBenefit: number;
}

/** Nur die Felder, die `epicBenefitFromKpis` braucht — strukturell erfüllt von KPI-Rows/DTOs. */
export interface BenefitKpiFacts {
  baseline: number | null;
  target: number | null;
  valuePerUnit: number | null;
  benefitKind: string;
  recurringInterval: string;
}

/**
 * Leitet den Business-Case-Nutzen **direkt aus den KPIs** ab — der €-Wert bei
 * 100 % Zielerreichung (single source of truth, ersetzt die manuelle Eingabe):
 *  - **Einmaliger Nutzen** = Σ über one-time-KPIs von `plannedₖ = |Ziel−Baseline| × valuePerUnit`.
 *  - **Wiederkehrender Nutzen p.a.** = Σ über recurring-KPIs von `plannedₖ`, annualisiert
 *    (`recurringInterval="monthly"` → ×12, sonst ×1).
 * Bewertet = `valuePerUnit`, `baseline` und `target` gesetzt; sonst kein Beitrag → 0.
 */
export function epicBenefitFromKpis(kpis: BenefitKpiFacts[]): EpicBenefit {
  let oneTimeBenefit = 0;
  let recurringBenefit = 0;
  for (const k of kpis) {
    // `kpiPlanned` (Core) owns the |Ziel−Baseline|×€/Einheit-Formel inkl.
    // Annualisierung; hier bleibt nur das Bucketing nach Benefit-Art.
    const planned = kpiPlanned(k);
    if (planned === 0) continue;
    if (benefitKindOrDefault(k.benefitKind) === "one_time") {
      oneTimeBenefit += planned;
    } else {
      recurringBenefit += planned;
    }
  }
  return { oneTimeBenefit, recurringBenefit };
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
    valuePerUnit: k.valuePerUnit,
    benefitKind: k.benefitKind,
    recurringInterval: k.recurringInterval,
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
  // Nutzen wird direkt aus den KPIs berechnet (100 %-Zielerreichung), nicht mehr
  // manuell im Business Case gepflegt — kein bewerteter KPI → 0.
  const benefit = epicBenefitFromKpis(source.kpis);
  return {
    businessCase,
    hasBusinessCase: businessCaseHasContent(businessCase),
    costSlices,
    oneTimeBenefit: benefit.oneTimeBenefit,
    recurringBenefit: benefit.recurringBenefit,
    totals: computeBusinessCaseTotals(businessCase, benefit),
    costStart,
    goLive,
    benefitKpis: resolveBenefitWeights(source.kpis),
  };
}
