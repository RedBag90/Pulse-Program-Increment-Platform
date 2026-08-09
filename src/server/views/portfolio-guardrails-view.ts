/**
 * Page-Model fuer die SAFe Portfolio Guardrails (Roadmap-G4).
 *
 * Liefert pro Guardrail einen Ist-Mix vs. Soll-Mix:
 *  - Investment by Horizon (H1/H2/H3) — McKinsey 3-Horizons
 *  - Capacity Allocation (Business vs Enabler) — wertstiftende
 *    Arbeit vs Architectural Runway / Enabler-Brocken.
 *
 * Zwei Sichten pro Guardrail: **Count** (Anzahl Epics) und **Amount**
 * (Σ Implementation Cost aus dem Business Case). Reine Funktion ohne
 * DB-Zugriff — Aufrufer übergibt vorgeladene Rows.
 */

import {
  HORIZONS,
  type Horizon,
  type GuardrailTargets,
  epicCapacityBucket,
  isEpicType,
  isHorizon,
} from "@/domain/portfolio-guardrails";
import { computeMixAxis, type MixRow } from "@/domain/guardrail-rules";
import { STAGE_GATES } from "@/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";

export type { MixRow };

export type CapacityBucket = "business" | "enabler";

/**
 * Roh-Input pro Epic. `amount` ist die in der Card als "€"-Sicht
 * verwendete Zahl — typischerweise die Implementation-Cost aus dem
 * Business Case. `null` zaehlt nur in der Count-Sicht.
 */
export interface GuardrailsEpicInput {
  id: string;
  /** Epic-Titel — fuer den Tooltip am Stage-Tower-Quadrat. */
  title: string;
  epicType: string | null;
  investmentHorizon: string | null;
  /** Implementation Cost (€). null wenn kein Business Case oder ohne Kosten. */
  amount: number | null;
  /** SAFe-Kanban-Stage (L0..L5). Treibt die Stage-Tower-Spalten. */
  stageGate: string;
  /** Flag aus der Governance — Steering-Markierung am Quadrat. */
  needsSteeringAttention: boolean;
}

/** Eintrag im Stage-Tower bzw. Horizon-Tower — eines pro Epic. */
export interface StageTowerEpic {
  id: string;
  title: string;
  /** null = unklassifiziert, sonst H1/H2/H3. */
  horizon: Horizon | null;
  /** Stage-Gate (L0..L5) — fuer Tooltip + Sort im Horizon-Tower. */
  stageGate: StageGate;
  needsSteeringAttention: boolean;
}

/** Spaltenschluessel fuer den Horizon-by-Horizon-Tower. `none` sammelt
 *  alle Epics ohne Horizon-Klassifikation. Reihenfolge H3..H1 entspricht
 *  der strategischen Lese-Richtung („Innovate" links, „Sustain" rechts). */
export const HORIZON_COLUMNS = ["h3", "h2", "h1", "none"] as const;
export type HorizonColumn = (typeof HORIZON_COLUMNS)[number];

export interface HorizonGuardrailModel {
  rows: Record<Horizon, MixRow>;
  /** Epics ohne Horizon-Klassifikation. */
  unclassifiedCount: number;
  /** Σ amounts der unklassifizierten Epics (sind aus dem Amount-Mix raus). */
  unclassifiedAmount: number;
  /** Gesamtzahl Epics im Scope. */
  totalCount: number;
  /** Max(|delta|) ueber alle Buckets, im Count- bzw. Amount-Mix. */
  maxAbsDeltaCount: number;
  maxAbsDeltaAmount: number;
  /** Ampel: gruen <5pp, amber 5..15pp, rot >15pp (groesster Bucket-Delta). */
  status: "green" | "amber" | "red" | "unknown";
  /** Epics pro Stage, horizon-getaggt — Input fuer den Stage-Tower. */
  epicsByStage: Record<StageGate, StageTowerEpic[]>;
  /** Epics pro Horizon-Spalte (H1/H2/H3/none) — Input fuer den
   *  Horizon-by-Horizon-Tower. Sort pro Spalte nach Stage-Index. */
  epicsByHorizon: Record<HorizonColumn, StageTowerEpic[]>;
}

export interface CapacityGuardrailModel {
  rows: Record<CapacityBucket, MixRow>;
  unclassifiedCount: number;
  unclassifiedAmount: number;
  totalCount: number;
  maxAbsDeltaCount: number;
  maxAbsDeltaAmount: number;
  status: "green" | "amber" | "red" | "unknown";
}

export interface PortfolioGuardrailsModel {
  horizon: HorizonGuardrailModel;
  capacity: CapacityGuardrailModel;
  /** Hinweis: > 20 % der Epics ohne Klassifikation → Mix ist nur Indiz. */
  horizonCoverageThin: boolean;
  capacityCoverageThin: boolean;
}

const COVERAGE_THIN_THRESHOLD = 0.2;

function statusFor(maxAbsDelta: number, hasData: boolean): "green" | "amber" | "red" | "unknown" {
  if (!hasData) return "unknown";
  if (maxAbsDelta > 0.15) return "red";
  if (maxAbsDelta > 0.05) return "amber";
  return "green";
}

export function computePortfolioGuardrails(input: {
  epics: readonly GuardrailsEpicInput[];
  targets: GuardrailTargets;
}): PortfolioGuardrailsModel {
  const { epics, targets } = input;

  // ---- Horizon — Mix-Math via computeMixAxis, Tower-Aggregation hier ----
  const horizonMix = computeMixAxis<GuardrailsEpicInput, Horizon>({
    items: epics,
    buckets: HORIZONS,
    classify: (e) => (isHorizon(e.investmentHorizon) ? e.investmentHorizon : null),
    amountOf: (e) => e.amount,
    targets: targets.horizon,
  });

  const epicsByStage = Object.fromEntries(
    STAGE_GATES.map((g) => [g, []] as const),
  ) as unknown as Record<StageGate, StageTowerEpic[]>;
  const epicsByHorizon = Object.fromEntries(
    HORIZON_COLUMNS.map((c) => [c, []] as const),
  ) as unknown as Record<HorizonColumn, StageTowerEpic[]>;

  for (const e of epics) {
    const horizon: Horizon | null = isHorizon(e.investmentHorizon) ? e.investmentHorizon : null;
    const stage = (STAGE_GATES as readonly string[]).includes(e.stageGate)
      ? (e.stageGate as StageGate)
      : null;
    if (stage != null) {
      const towerEpic: StageTowerEpic = {
        id: e.id,
        title: e.title,
        horizon,
        stageGate: stage,
        needsSteeringAttention: e.needsSteeringAttention,
      };
      epicsByStage[stage].push(towerEpic);
      const col: HorizonColumn = horizon ?? "none";
      epicsByHorizon[col].push(towerEpic);
    }
  }

  // Sortiert jede Stage-Spalte nach Horizon-Rank — gleiche Farbe sammelt
  // sich zu einem visuellen Block. Stabil (Array.sort), gleiche Horizon-
  // Gruppe behaelt ihre DB-Reihenfolge.
  const horizonRank: Record<string, number> = { h1: 0, h2: 1, h3: 2 };
  for (const g of STAGE_GATES) {
    epicsByStage[g].sort(
      (a, b) =>
        (a.horizon != null ? horizonRank[a.horizon]! : 3) -
        (b.horizon != null ? horizonRank[b.horizon]! : 3),
    );
  }

  // Sortiert jede Horizon-Spalte nach Stage-Index (L0 unten, L5 oben).
  // Die Quadrate sind unifarben — die Reihenfolge gibt dem Tooltip
  // einen sinnvollen Funnel-Lauf.
  const stageRank: Record<string, number> = Object.fromEntries(STAGE_GATES.map((g, i) => [g, i]));
  for (const c of HORIZON_COLUMNS) {
    epicsByHorizon[c].sort((a, b) => (stageRank[a.stageGate] ?? 0) - (stageRank[b.stageGate] ?? 0));
  }

  // ---- Capacity — Mix-Math via computeMixAxis ----
  const capacityMix = computeMixAxis<GuardrailsEpicInput, CapacityBucket>({
    items: epics,
    buckets: ["business", "enabler"] as const,
    classify: (e) => {
      const type = isEpicType(e.epicType) ? e.epicType : null;
      return epicCapacityBucket(type);
    },
    amountOf: (e) => e.amount,
    targets: targets.capacity,
  });

  const totalEpics = epics.length;
  const horizonCoverageThin =
    totalEpics > 0 && horizonMix.unclassifiedCount / totalEpics > COVERAGE_THIN_THRESHOLD;
  const capacityCoverageThin =
    totalEpics > 0 && capacityMix.unclassifiedCount / totalEpics > COVERAGE_THIN_THRESHOLD;

  return {
    horizon: {
      rows: horizonMix.rows,
      unclassifiedCount: horizonMix.unclassifiedCount,
      unclassifiedAmount: horizonMix.unclassifiedAmount,
      totalCount: totalEpics,
      maxAbsDeltaCount: horizonMix.maxAbsCount,
      maxAbsDeltaAmount: horizonMix.maxAbsAmount,
      status: statusFor(
        horizonMix.classifiedAmount > 0
          ? Math.max(horizonMix.maxAbsCount, horizonMix.maxAbsAmount)
          : horizonMix.maxAbsCount,
        horizonMix.classifiedCount > 0,
      ),
      epicsByStage,
      epicsByHorizon,
    },
    capacity: {
      rows: capacityMix.rows,
      unclassifiedCount: capacityMix.unclassifiedCount,
      unclassifiedAmount: capacityMix.unclassifiedAmount,
      totalCount: totalEpics,
      maxAbsDeltaCount: capacityMix.maxAbsCount,
      maxAbsDeltaAmount: capacityMix.maxAbsAmount,
      status: statusFor(
        capacityMix.classifiedAmount > 0
          ? Math.max(capacityMix.maxAbsCount, capacityMix.maxAbsAmount)
          : capacityMix.maxAbsCount,
        capacityMix.classifiedCount > 0,
      ),
    },
    horizonCoverageThin,
    capacityCoverageThin,
  };
}
