import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import {
  epicCascadeBreakdown,
  type GoalNodeMeta,
  type EpicGoalLinkInput,
  type EpicCascadeContribution,
} from "@/domain/goals-rollup";

// ── Einheiten-Kaskade: GoalEpicLink-Pfad (Epic → mehrere Ziele) ───────────────

/** Eine Ziel-Verknüpfung dieses Epics (neuer Kaskaden-Pfad) für die KPIs-Tab. */
export interface EpicGoalLinkRow {
  objectiveId: string;
  goalTitle: string;
  /** Metrik-Einheit des Ziels (Freitext-Label). */
  goalUnit: string | null;
  // ── Ziel-eigene KPI (Metrik-Block des Ziels) — für die Messwert-Anzeige ──
  goalMetricName: string | null;
  goalMetricType: string;
  goalPrecision: number;
  goalCurrencyCode: string | null;
  goalBaseline: number | null;
  goalTarget: number | null;
  goalCurrent: number | null;
  /** Gewählte Erfolgs-KPI (null = Alt-€-Link ohne Kaskade). */
  kpiId: string | null;
  kpiName: string | null;
  kpiUnit: string | null;
  /** Messwerte der gewählten Erfolgs-KPI. */
  kpiBaseline: number | null;
  kpiTarget: number | null;
  kpiCurrent: number | null;
  /** Ziel-Einheit je 1 KPI-Einheit (z. B. 10000 €/Wagon). */
  conversionFactor: number | null;
  impactKind: string;
  recurringInterval: string;
}

export interface EpicGoalLinksModel {
  /** Alle Ziel-Links dieses Epics (für die „Verknüpfte Ziele"-Zeilen). */
  links: EpicGoalLinkRow[];
  /** Der Kaskaden-Beitrag je Link Ebene für Ebene (verknüpftes Ziel → Top-Ziel). */
  cascade: EpicCascadeContribution[];
}

/**
 * Lädt die GoalEpicLink-Verknüpfungen eines Epics (neuer Einheiten-Kaskaden-Pfad)
 * und rechnet den Nutzen je verknüpfter Erfolgs-KPI die Ziel-Eltern-Kette bis zum
 * Top-Ziel hoch (`epicCascadeBreakdown`, Ebene für Ebene). Speist die KPIs-Tab-
 * Zeilen „Verknüpfte Ziele" und die Business-Case-Nutzen-Kacheln.
 */
export async function loadEpicGoalLinks(
  db: PrismaClient,
  principal: Principal,
  epicId: string,
): Promise<EpicGoalLinksModel> {
  const { tenantId } = principal;

  const links = await db.goalEpicLink.findMany({
    where: { tenantId, epicId },
    include: {
      objective: {
        select: {
          id: true,
          title: true,
          metricName: true,
          metricUnit: true,
          metricType: true,
          precision: true,
          currencyCode: true,
          baseline: true,
          target: true,
          current: true,
        },
      },
      kpi: {
        select: {
          id: true,
          name: true,
          unit: true,
          baseline: true,
          target: true,
          measurements: true,
        },
      },
    },
  });
  if (links.length === 0) return { links: [], cascade: [] };

  const linkRows: EpicGoalLinkRow[] = links.map((l) => ({
    objectiveId: l.objectiveId,
    goalTitle: l.objective.title,
    goalUnit: l.objective.metricUnit,
    goalMetricName: l.objective.metricName,
    goalMetricType: l.objective.metricType,
    goalPrecision: l.objective.precision,
    goalCurrencyCode: l.objective.currencyCode,
    goalBaseline: toFloat(l.objective.baseline),
    goalTarget: toFloat(l.objective.target),
    goalCurrent: toFloat(l.objective.current),
    kpiId: l.kpi?.id ?? null,
    kpiName: l.kpi?.name ?? null,
    kpiUnit: l.kpi?.unit ?? null,
    kpiBaseline: l.kpi ? toFloat(l.kpi.baseline) : null,
    kpiTarget: l.kpi ? toFloat(l.kpi.target) : null,
    kpiCurrent: l.kpi ? latestMeasurement(l.kpi.measurements) : null,
    conversionFactor: toFloat(l.conversionFactor),
    impactKind: l.impactKind,
    recurringInterval: l.recurringInterval,
  }));

  // Alle Tenant-Ziele für den Aufstieg zum Top-Ziel (id → Meta).
  const nodes = await db.objective.findMany({
    where: { tenantId },
    select: {
      id: true,
      parentObjectiveId: true,
      title: true,
      metricUnit: true,
      parentUnitPerChildUnit: true,
    },
  });
  const nodesById = new Map<string, GoalNodeMeta>(
    nodes.map((n) => [
      n.id,
      {
        id: n.id,
        parentId: n.parentObjectiveId,
        name: n.title,
        unit: n.metricUnit,
        parentUnitPerChildUnit: toFloat(n.parentUnitPerChildUnit),
      },
    ]),
  );

  const benefitInputs: EpicGoalLinkInput[] = links
    .filter((l) => l.kpi && l.conversionFactor != null)
    .map((l) => ({
      objectiveId: l.objectiveId,
      kpi: {
        id: l.kpi!.id,
        baseline: toFloat(l.kpi!.baseline),
        target: toFloat(l.kpi!.target),
        current: latestMeasurement(l.kpi!.measurements),
        valuePerUnit: null,
      },
      conversionFactor: toFloat(l.conversionFactor),
      impactKind: l.impactKind,
      recurringInterval: l.recurringInterval,
      kpiName: l.kpi?.name ?? null,
    }));

  return {
    links: linkRows,
    cascade: epicCascadeBreakdown(benefitInputs, nodesById),
  };
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
  if (pts.length === 0) return null;
  const sorted = pts
    .filter((p) => typeof p.value === "number" && typeof p.date === "string")
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const last = sorted[sorted.length - 1];
  return last?.value ?? null;
}
