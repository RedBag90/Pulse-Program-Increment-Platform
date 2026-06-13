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
import { STAGE_GATES } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";

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

/** Eintrag im Stage-Tower — eines pro Epic in der jeweiligen Stage. */
export interface StageTowerEpic {
  id: string;
  title: string;
  /** null = unklassifiziert, sonst H1/H2/H3. */
  horizon: Horizon | null;
  needsSteeringAttention: boolean;
}

export interface MixRow {
  /** Anzahl klassifizierter Epics in diesem Bucket. */
  count: number;
  /** Anteil im Count-Mix (0..1). Bezugsgroesse: Σ klassifizierter Counts. */
  countShare: number;
  /** Σ amount in € im Bucket. */
  amount: number;
  /** Anteil im Amount-Mix (0..1). Bezugsgroesse: Σ klassifizierter amounts. */
  amountShare: number;
  /** Soll-Anteil (0..1). */
  target: number;
  /** countShare - target (signed). */
  deltaCount: number;
  /** amountShare - target (signed). */
  deltaAmount: number;
}

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

function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

export function computePortfolioGuardrails(input: {
  epics: readonly GuardrailsEpicInput[];
  targets: GuardrailTargets;
}): PortfolioGuardrailsModel {
  const { epics, targets } = input;

  // ---- Horizon ----
  const horizonCounts: Record<Horizon, number> = { h1: 0, h2: 0, h3: 0 };
  const horizonAmounts: Record<Horizon, number> = { h1: 0, h2: 0, h3: 0 };
  let horizonUnclassifiedCount = 0;
  let horizonUnclassifiedAmount = 0;
  let horizonClassifiedCount = 0;
  let horizonClassifiedAmount = 0;

  const epicsByStage = Object.fromEntries(
    STAGE_GATES.map((g) => [g, []] as const),
  ) as unknown as Record<StageGate, StageTowerEpic[]>;

  for (const e of epics) {
    const amt = e.amount ?? 0;
    const horizon: Horizon | null = isHorizon(e.investmentHorizon) ? e.investmentHorizon : null;
    if (horizon != null) {
      horizonCounts[horizon] += 1;
      horizonAmounts[horizon] += amt;
      horizonClassifiedCount += 1;
      horizonClassifiedAmount += amt;
    } else {
      horizonUnclassifiedCount += 1;
      horizonUnclassifiedAmount += amt;
    }
    const stage = (STAGE_GATES as readonly string[]).includes(e.stageGate)
      ? (e.stageGate as StageGate)
      : null;
    if (stage != null) {
      epicsByStage[stage].push({
        id: e.id,
        title: e.title,
        horizon,
        needsSteeringAttention: e.needsSteeringAttention,
      });
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

  // Targets summieren sich auf 100 — Anteile durch 100 teilen.
  const horizonTargets: Record<Horizon, number> = {
    h1: targets.horizon.h1 / 100,
    h2: targets.horizon.h2 / 100,
    h3: targets.horizon.h3 / 100,
  };

  const horizonRows = {} as Record<Horizon, MixRow>;
  let horizonMaxAbsCount = 0;
  let horizonMaxAbsAmount = 0;
  for (const h of HORIZONS) {
    const countShare = share(horizonCounts[h], horizonClassifiedCount);
    const amountShare = share(horizonAmounts[h], horizonClassifiedAmount);
    const target = horizonTargets[h];
    const dc = countShare - target;
    const da = amountShare - target;
    if (Math.abs(dc) > horizonMaxAbsCount) horizonMaxAbsCount = Math.abs(dc);
    if (Math.abs(da) > horizonMaxAbsAmount) horizonMaxAbsAmount = Math.abs(da);
    horizonRows[h] = {
      count: horizonCounts[h],
      countShare,
      amount: horizonAmounts[h],
      amountShare,
      target,
      deltaCount: dc,
      deltaAmount: da,
    };
  }

  // ---- Capacity ----
  const capacityCounts: Record<CapacityBucket, number> = { business: 0, enabler: 0 };
  const capacityAmounts: Record<CapacityBucket, number> = { business: 0, enabler: 0 };
  let capacityUnclassifiedCount = 0;
  let capacityUnclassifiedAmount = 0;
  let capacityClassifiedCount = 0;
  let capacityClassifiedAmount = 0;

  for (const e of epics) {
    const amt = e.amount ?? 0;
    const type = isEpicType(e.epicType) ? e.epicType : null;
    const bucket = epicCapacityBucket(type);
    if (bucket) {
      capacityCounts[bucket] += 1;
      capacityAmounts[bucket] += amt;
      capacityClassifiedCount += 1;
      capacityClassifiedAmount += amt;
    } else {
      capacityUnclassifiedCount += 1;
      capacityUnclassifiedAmount += amt;
    }
  }

  const capacityTargets: Record<CapacityBucket, number> = {
    business: targets.capacity.business / 100,
    enabler: targets.capacity.enabler / 100,
  };

  const capacityRows = {} as Record<CapacityBucket, MixRow>;
  let capacityMaxAbsCount = 0;
  let capacityMaxAbsAmount = 0;
  for (const b of ["business", "enabler"] as const) {
    const countShare = share(capacityCounts[b], capacityClassifiedCount);
    const amountShare = share(capacityAmounts[b], capacityClassifiedAmount);
    const target = capacityTargets[b];
    const dc = countShare - target;
    const da = amountShare - target;
    if (Math.abs(dc) > capacityMaxAbsCount) capacityMaxAbsCount = Math.abs(dc);
    if (Math.abs(da) > capacityMaxAbsAmount) capacityMaxAbsAmount = Math.abs(da);
    capacityRows[b] = {
      count: capacityCounts[b],
      countShare,
      amount: capacityAmounts[b],
      amountShare,
      target,
      deltaCount: dc,
      deltaAmount: da,
    };
  }

  const totalEpics = epics.length;
  const horizonCoverageThin =
    totalEpics > 0 && horizonUnclassifiedCount / totalEpics > COVERAGE_THIN_THRESHOLD;
  const capacityCoverageThin =
    totalEpics > 0 && capacityUnclassifiedCount / totalEpics > COVERAGE_THIN_THRESHOLD;

  return {
    horizon: {
      rows: horizonRows,
      unclassifiedCount: horizonUnclassifiedCount,
      unclassifiedAmount: horizonUnclassifiedAmount,
      totalCount: totalEpics,
      maxAbsDeltaCount: horizonMaxAbsCount,
      maxAbsDeltaAmount: horizonMaxAbsAmount,
      status: statusFor(
        horizonClassifiedAmount > 0
          ? Math.max(horizonMaxAbsCount, horizonMaxAbsAmount)
          : horizonMaxAbsCount,
        horizonClassifiedCount > 0,
      ),
      epicsByStage,
    },
    capacity: {
      rows: capacityRows,
      unclassifiedCount: capacityUnclassifiedCount,
      unclassifiedAmount: capacityUnclassifiedAmount,
      totalCount: totalEpics,
      maxAbsDeltaCount: capacityMaxAbsCount,
      maxAbsDeltaAmount: capacityMaxAbsAmount,
      status: statusFor(
        capacityClassifiedAmount > 0
          ? Math.max(capacityMaxAbsCount, capacityMaxAbsAmount)
          : capacityMaxAbsCount,
        capacityClassifiedCount > 0,
      ),
    },
    horizonCoverageThin,
    capacityCoverageThin,
  };
}
