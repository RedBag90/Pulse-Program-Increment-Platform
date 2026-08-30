/**
 * Loader für den **Benefit-Wasserfall** des Portfolio-Dashboards (Momentaufnahme
 * „Wert je Status vs. Zielwert"). Komponiert zwei Quellen:
 *  - **Ziele (Core/goals)**: messbare Kopf-Ziele (`Objective.target`) und den
 *    Epic-Beitrag in Ziel-Einheit über die Erfolgs-KPI-Kaskade (`epicTopGoalBenefits`).
 *  - **Reifegrad (Work)**: aktuelles `stageGate` + abgeleitete Sub-Stage
 *    (`subStageFor`; L4.2 kommt aus der abgenommenen Bestätigung).
 *
 * Gibt ein serialisierbares DTO zurück; die eigentliche Wasserfall-Mathematik und
 * der Projekt-ID-Filter laufen client-seitig in `buildGoalWaterfall`.
 *
 * Modul-Hinweis (ADR-0013): Work → Core ist erlaubt; hier wird Core/goals nur
 * gelesen. Kein Import von Work-internem in Goals.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { StageGate, TenantId } from "@/modules/core/kernel/domain/types";
import {
  epicGoalBenefitsPerNode,
  type GoalNodeMeta,
  type EpicGoalLinkInput,
} from "@/modules/core/goals/domain/goals-rollup";
import { subStageFor } from "@/modules/work/domain/stage-gate";
import type {
  GoalWaterfallGoal,
  GoalWaterfallEpic,
  GoalWaterfallData,
} from "@/modules/work/domain/goal-benefit-waterfall";

export type { GoalWaterfallData };

/**
 * Lädt die Wasserfall-Daten aller messbaren Ziele eines Tenants — Wurzel-Ziele
 * **und** Unterziele mit eigenem Zielwert (wählbar im Ziel-Selektor, z. B. je
 * Wertstrom): pro Ziel die verknüpften Epics mit ihrem Beitrag
 * (planned/realized) in der Einheit des jeweiligen Ziel-Knotens und ihrem
 * aktuellen Reifegrad (Gate + Sub-Stage).
 */
export async function getGoalBenefitWaterfalls(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<GoalWaterfallData> {
  const [objectives, links] = await Promise.all([
    db.objective.findMany({
      where: { tenantId },
      select: {
        id: true,
        parentObjectiveId: true,
        title: true,
        metricType: true,
        metricUnit: true,
        currencyCode: true,
        precision: true,
        target: true,
        parentUnitPerChildUnit: true,
      },
    }),
    db.goalEpicLink.findMany({
      where: { tenantId },
      include: {
        kpi: { select: { id: true, name: true, baseline: true, target: true, measurements: true } },
      },
    }),
  ]);

  // Meta-Karte für den Einheiten-Aufstieg zum Kopf-Ziel.
  const nodesById = new Map<string, GoalNodeMeta>(
    objectives.map((o) => [
      o.id,
      {
        id: o.id,
        parentId: o.parentObjectiveId,
        name: o.title,
        unit: o.metricUnit,
        parentUnitPerChildUnit: toFloat(o.parentUnitPerChildUnit),
      },
    ]),
  );

  // Messbare Ziele = alle Objectives mit gesetztem Zielwert (Referenzlinie) —
  // Wurzeln wie Unterziele; die Hierarchie (parentId) steuert den Selektor.
  const goals: GoalWaterfallGoal[] = [];
  const goalIds = new Set<string>();
  for (const o of objectives) {
    const target = toFloat(o.target);
    if (target != null) {
      goals.push({
        id: o.id,
        parentId: o.parentObjectiveId,
        title: o.title,
        target,
        metricType: o.metricType,
        metricUnit: o.metricUnit,
        currencyCode: o.currencyCode,
        precision: o.precision,
      });
      goalIds.add(o.id);
    }
  }

  // KPI-getriebene Erfolgs-Links je Epic sammeln (nur diese tragen zur Kaskade bei).
  const inputsByEpic = new Map<string, EpicGoalLinkInput[]>();
  for (const l of links) {
    if (!l.kpi || l.conversionFactor == null) continue;
    let inputs = inputsByEpic.get(l.epicId);
    if (!inputs) {
      inputs = [];
      inputsByEpic.set(l.epicId, inputs);
    }
    inputs.push({
      objectiveId: l.objectiveId,
      kpi: {
        id: l.kpi.id,
        baseline: toFloat(l.kpi.baseline),
        target: toFloat(l.kpi.target),
        current: latestMeasurement(l.kpi.measurements),
        valuePerUnit: null,
      },
      conversionFactor: toFloat(l.conversionFactor),
      impactKind: l.impactKind,
      recurringInterval: l.recurringInterval,
      kpiName: l.kpi.name,
    });
  }

  // Reifegrad je beitragendem Epic (aktuelles Gate + abgeleitete Sub-Stage).
  const maturityByEpic = await loadEpicMaturity(db, tenantId, [...inputsByEpic.keys()]);

  // Je Ziel die Epic-Beiträge zusammensetzen: epicGoalBenefitsPerNode schreibt
  // den Beitrag jedem Knoten der Aufstiegskette gut (Unterziel unskaliert,
  // Vorfahren skaliert — Wurzel-Werte identisch zum bisherigen Top-Rollup);
  // wir hängen den Reifegrad des Epics an.
  const epicsByGoal: Record<string, GoalWaterfallEpic[]> = {};
  for (const gid of goalIds) epicsByGoal[gid] = [];

  for (const [epicId, inputs] of inputsByEpic) {
    const maturity = maturityByEpic.get(epicId);
    if (!maturity) continue; // Epic nicht (mehr) vorhanden/gelöscht
    const perGoal = new Map<string, { planned: number; realized: number }>();
    for (const b of epicGoalBenefitsPerNode(inputs, nodesById)) {
      if (!goalIds.has(b.goalId)) continue; // Knoten ohne Zielwert → kein Wasserfall
      const prev = perGoal.get(b.goalId);
      if (prev) {
        prev.planned += b.planned;
        prev.realized += b.realized;
      } else {
        perGoal.set(b.goalId, { planned: b.planned, realized: b.realized });
      }
    }
    for (const [gid, val] of perGoal) {
      if (val.planned === 0 && val.realized === 0) continue;
      epicsByGoal[gid]!.push({
        epicId,
        gate: maturity.gate,
        subStage: maturity.subStage,
        planned: val.planned,
        realized: val.realized,
      });
    }
  }

  return { goals, epicsByGoal };
}

/** Aktuelles Gate + abgeleitete Sub-Stage (L4.1/L4.2) je Epic. */
async function loadEpicMaturity(
  db: PrismaClient,
  tenantId: TenantId,
  epicIds: string[],
): Promise<Map<string, { gate: StageGate; subStage: ReturnType<typeof subStageFor> }>> {
  const out = new Map<string, { gate: StageGate; subStage: ReturnType<typeof subStageFor> }>();
  if (epicIds.length === 0) return out;
  const rows = await db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, id: { in: epicIds } },
    select: {
      id: true,
      stageGate: true,
      approvedAt: true,
      implementationCompletedAt: true,
    },
  });
  for (const r of rows) {
    const gate = r.stageGate as StageGate;
    const subStage = subStageFor({
      stageGate: gate,
      approvedAt: r.approvedAt,
      implementationCompletedAt: r.implementationCompletedAt,
    });
    out.set(r.id, { gate, subStage });
  }
  return out;
}

function toFloat(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  if (typeof d === "number") return d;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function latestMeasurement(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const pts = raw as Array<{ date?: string; value?: number }>;
  const sorted = pts
    .filter((p) => typeof p.value === "number" && typeof p.date === "string")
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const last = sorted[sorted.length - 1];
  return last?.value ?? null;
}
