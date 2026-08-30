/**
 * Page-Model fuer die SAFe Portfolio Guardrails (Roadmap-G4).
 *
 * Liefert pro Guardrail einen Ist-Mix vs. Soll-Mix:
 *  - Investment by Horizon (H1/H2/H3) — McKinsey 3-Horizons
 *  - Capacity Allocation (Business vs Enabler) — wertstiftende
 *    Arbeit vs Architectural Runway / Enabler-Brocken.
 *  - Business-Owner-Engagement (Guardrail 4) — Abdeckung + Reaktionszeit
 *    der BO-Freigaben. Kein Mix; eigene Berechnung, optionaler Input.
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
} from "@/modules/work/domain/portfolio-guardrails";
import { computeMixAxis, type MixRow } from "@/modules/work/domain/guardrail-rules";
import { thresholdTier, type AmpelTier } from "@/modules/work/domain/portfolio-ampel";
import { MS_PER_DAY } from "@/modules/core/kernel/domain/calendar";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";

export type { MixRow };

export type CapacityBucket = "business" | "enabler";

/** Ampel einer Guardrail-Achse. Eine Sprache fuer alle drei Karten. */
export type GuardrailStatus = "green" | "amber" | "red" | "unknown";

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
export const HORIZON_COLUMNS = ["h3", "h2", "h1", "h0", "none"] as const;
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
  status: GuardrailStatus;
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
  status: GuardrailStatus;
}

/**
 * Eine `business_owner`-Freigabezeile eines Epics. Der Service filtert auf
 * `party`; welche **Revision** zaehlt, entscheidet diese Schicht — das ist eine
 * Regel, keine Query-Eigenheit, und soll testbar bleiben.
 */
export interface BoApprovalInput {
  /** Freigabezyklus, zu dem die Zeile gehoert. */
  revision: number;
  /** null = Zeile existiert, aber ohne benannte Person. */
  approverUserId: string | null;
  approverLabel: string | null;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
}

/** Ein Epic im Freigabelauf mit seinen BO-Zeilen (alle Revisionen). */
export interface BoEngagementEpicInput {
  epicId: string;
  title: string;
  /** Laufender Freigabezyklus — nur seine Zeilen zaehlen. */
  approvalRevision: number;
  approvals: readonly BoApprovalInput[];
}

/** Eine offene BO-Freigabe jenseits des Zeitrahmens. */
export interface OverdueBoApproval {
  epicId: string;
  epicTitle: string;
  /** null = niemandem zugewiesen — ein anderer Mangel als „liegt lange". */
  approverLabel: string | null;
  daysOpen: number;
}

export interface EngagementGuardrailModel {
  /** Epics im Freigabelauf. 0 ⇒ die Messung hat noch nicht begonnen. */
  scopeCount: number;
  /** Davon mit BO-Zeile UND benannter Person. */
  coveredCount: number;
  /** `coveredCount / scopeCount` (0..1); null bei leerem Scope. */
  coverageRatio: number | null;
  /** BO-Zeilen insgesamt (aktuelle Revisionen). */
  approvalCount: number;
  /** Davon rechtzeitig bedient. */
  timelyCount: number;
  /** `timelyCount / approvalCount` (0..1); null wenn es keine Zeile gibt. */
  responseRatio: number | null;
  /** Offene Zeilen jenseits des Zeitrahmens, laengste Wartezeit zuerst. */
  overdue: OverdueBoApproval[];
  /** Ziele, durchgereicht fuer die Anzeige. */
  coverageTarget: number;
  responseDays: number;
  /** Schlechteres Tier der zwei Quoten. */
  status: GuardrailStatus;
}

export interface PortfolioGuardrailsModel {
  horizon: HorizonGuardrailModel;
  capacity: CapacityGuardrailModel;
  /** Hinweis: > 20 % der Epics ohne Klassifikation → Mix ist nur Indiz. */
  horizonCoverageThin: boolean;
  capacityCoverageThin: boolean;
  /** Guardrail 4. `undefined`, wenn der Aufrufer keine BO-Daten uebergibt. */
  engagement?: EngagementGuardrailModel;
}

const COVERAGE_THIN_THRESHOLD = 0.2;

function statusFor(maxAbsDelta: number, hasData: boolean): GuardrailStatus {
  if (!hasData) return "unknown";
  if (maxAbsDelta > 0.15) return "red";
  if (maxAbsDelta > 0.05) return "amber";
  return "green";
}

/** `thresholdTier` spricht „rose", die Guardrail-Flaeche spricht „red". */
const TIER_TO_STATUS: Record<AmpelTier, GuardrailStatus> = {
  green: "green",
  amber: "amber",
  rose: "red",
};
const TIER_RANK: Record<AmpelTier, number> = { green: 0, amber: 1, rose: 2 };

/**
 * Guardrail 4 — Business-Owner-Engagement. Zwei Quoten statt eines Mix:
 *
 *  - **Abdeckung**: Anteil der Epics im Freigabelauf mit benanntem Business Owner.
 *  - **Reaktion**: Anteil der BO-Zeilen, die rechtzeitig bedient wurden —
 *    entschieden innerhalb `responseDays`, **oder** noch offen und juenger als
 *    `responseDays`. Eine spaet entschiedene Zeile ist nicht rechtzeitig, steht
 *    aber auch nicht mehr in der Ueberfaellig-Liste; die fuehrt nur offene.
 *
 * Rein, `now` injiziert — die Tage-Rechnung muss im Test deterministisch sein.
 */
export function computeBusinessOwnerEngagement(input: {
  epics: readonly BoEngagementEpicInput[];
  targets: GuardrailTargets["engagement"];
  now: Date;
}): EngagementGuardrailModel {
  const { epics, targets, now } = input;
  const { coverage: coverageTarget, responseDays } = targets;
  const windowMs = responseDays * MS_PER_DAY;

  let coveredCount = 0;
  let approvalCount = 0;
  let timelyCount = 0;
  const overdue: OverdueBoApproval[] = [];

  for (const e of epics) {
    // Nur der laufende Zyklus. Ohne diesen Schnitt zaehlten abgeschlossene
    // Freigaben frueherer Revisionen mit und die Quote waere dauerhaft zu gut.
    const current = e.approvals.filter((a) => a.revision === e.approvalRevision);
    if (current.some((a) => a.approverUserId != null)) coveredCount += 1;
    for (const a of current) {
      approvalCount += 1;
      const waitedMs = (a.decidedAt ?? now).getTime() - a.requestedAt.getTime();
      if (waitedMs <= windowMs) {
        timelyCount += 1;
      } else if (a.decidedAt == null) {
        overdue.push({
          epicId: e.epicId,
          epicTitle: e.title,
          approverLabel: a.approverLabel,
          daysOpen: Math.floor(waitedMs / MS_PER_DAY),
        });
      }
    }
  }
  overdue.sort((a, b) => b.daysOpen - a.daysOpen);

  const scopeCount = epics.length;
  const coverageRatio = scopeCount > 0 ? coveredCount / scopeCount : null;
  const responseRatio = approvalCount > 0 ? timelyCount / approvalCount : null;

  // Schlechtestes Tier gewinnt: eine gute Reaktionszeit auf wenigen Zeilen darf
  // eine lueckenhafte Abdeckung nicht gruen faerben.
  const tiers: AmpelTier[] = [];
  if (coverageRatio != null) tiers.push(thresholdTier(coverageRatio));
  if (responseRatio != null) tiers.push(thresholdTier(responseRatio));
  const worst = tiers.reduce<AmpelTier | null>(
    (acc, t) => (acc == null || TIER_RANK[t] > TIER_RANK[acc] ? t : acc),
    null,
  );

  return {
    scopeCount,
    coveredCount,
    coverageRatio,
    approvalCount,
    timelyCount,
    responseRatio,
    overdue,
    coverageTarget,
    responseDays,
    status: worst == null ? "unknown" : TIER_TO_STATUS[worst],
  };
}

export function computePortfolioGuardrails(input: {
  epics: readonly GuardrailsEpicInput[];
  targets: GuardrailTargets;
  /** Guardrail 4 — optional. Fehlt er, bleibt `engagement` undefined. */
  engagement?: { epics: readonly BoEngagementEpicInput[]; now: Date };
}): PortfolioGuardrailsModel {
  const { epics, targets, engagement } = input;

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
  const horizonRank: Record<string, number> = { h3: 0, h2: 1, h1: 2, h0: 3 };
  for (const g of STAGE_GATES) {
    epicsByStage[g].sort(
      (a, b) =>
        (a.horizon != null ? horizonRank[a.horizon]! : 4) -
        (b.horizon != null ? horizonRank[b.horizon]! : 4),
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
    ...(engagement && {
      engagement: computeBusinessOwnerEngagement({
        epics: engagement.epics,
        targets: targets.engagement,
        now: engagement.now,
      }),
    }),
  };
}
