import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  epicCascadeBreakdown,
  epicTopGoalBenefits,
  type GoalNodeMeta,
  type EpicGoalLinkInput,
  type EpicCascadeContribution,
  type TopGoalBenefit,
} from "@/modules/core/goals/domain/goals-rollup";
import { parsePlanSnapshot, type KpiValuationTerms } from "@/modules/core/kpi/domain/kpi-outcome";
import { parseKpiMeasurements, type KpiMeasurement } from "@/modules/core/kpi/domain/kpi";

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
  /** Messreihe der gewählten Erfolgs-KPI — für die Zielerreichung zum Stichtag. */
  kpiMeasurements: KpiMeasurement[];
  /** Ziel-Einheit je 1 KPI-Einheit (z. B. 10000 €/Wagon). */
  conversionFactor: number | null;
  impactKind: string;
  recurringInterval: string;
  /**
   * Der Plan-Stand dieser Verknüpfung zur Business-Case-Freigabe, in
   * Ziel-Einheiten — `null` heisst **kein Plan-Bezug**, nicht „keine
   * Abweichung".
   *
   * Zusammengesetzt aus beiden Achsen: die Menge (`baseline`/`target`)
   * verantwortet die treibende KPI und liefert ihren eigenen Schnappschuss, den
   * Wert (`valuePerUnit`) verantwortet die Verknüpfung mit ihrem
   * Umrechnungsfaktor. Getrennt gehalten, damit die Mengen-Größen nicht doppelt
   * geführt werden und auseinanderlaufen können.
   */
  planSnapshot: KpiValuationTerms | null;
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
          planSnapshot: true,
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
    kpiMeasurements: l.kpi ? parseKpiMeasurements(l.kpi.measurements) : [],
    conversionFactor: toFloat(l.conversionFactor),
    impactKind: l.impactKind,
    recurringInterval: l.recurringInterval,
    planSnapshot: linkPlanTerms(l),
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

// ── Tenant-weit: Epic-Beitrag zu den Kopf-Zielen (Portfolio-Übersicht) ────────

/**
 * Ein Beitragswert in der Einheit *eines* Top-Ziels. Top-Ziele können
 * unterschiedliche Einheiten haben (€, %, Stück, …) — daher wird pro Einheit
 * getrennt ausgewiesen, nicht über Einheiten hinweg summiert. `unit` = das
 * Freitext-Label des Top-Ziels (null = ohne Einheit).
 */
export interface UnitValue {
  unit: string | null;
  planned: number;
  realized: number;
}

/**
 * Der aggregierte Beitrag eines Epics zu den Kopf-Zielen, getrennt nach
 * wiederkehrendem und einmaligem Effekt. Je Effekt eine Liste von Werten **pro
 * Einheit** (Plan `planned` / Ist `realized`) — so bleiben gemischte Einheiten
 * korrekt getrennt.
 */
export interface EpicGoalContribution {
  epicId: string;
  title: string;
  valueStreamName: string | null;
  recurring: UnitValue[];
  oneTime: UnitValue[];
}

/**
 * Reine Aggregation der `epicTopGoalBenefits`-Zeilen (je Top-Ziel × impactKind)
 * eines Epics auf zwei Effekt-Kübel, **je Einheit gruppiert** (gleiche Einheit
 * wird summiert, unterschiedliche bleiben getrennt). `impactKind === "recurring"`
 * → wiederkehrend, sonst einmalig. Ausgelagert für den Unit-Test.
 */
export function aggregateEpicContribution(benefits: readonly TopGoalBenefit[]): {
  recurring: UnitValue[];
  oneTime: UnitValue[];
} {
  const rec = new Map<string, UnitValue>();
  const one = new Map<string, UnitValue>();
  for (const b of benefits) {
    const bucket = b.impactKind === "recurring" ? rec : one;
    const key = b.unit ?? "";
    const prev = bucket.get(key);
    if (prev) {
      prev.planned += b.planned;
      prev.realized += b.realized;
    } else {
      bucket.set(key, { unit: b.unit, planned: b.planned, realized: b.realized });
    }
  }
  return { recurring: [...rec.values()], oneTime: [...one.values()] };
}

/**
 * Tenant-weit: für jedes Epic den Beitrag zu seinen Kopf-Zielen (via
 * `epicTopGoalBenefits` — KPI × `conversionFactor` die Ziel-Kette hoch bis zum
 * Top-Ziel), aggregiert nach Effektart. Nur Epics mit einem Beitrag ≠ 0 werden
 * zurückgegeben (Alt-€-Links ohne Conversion tragen 0 bei). Speist die
 * „Epic-Beitrag zu Kopf-Zielen"-Tabelle der Portfolio-Übersicht.
 */
export async function loadEpicGoalContributions(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<EpicGoalContribution[]> {
  const links = await db.goalEpicLink.findMany({
    where: { tenantId },
    include: {
      kpi: { select: { id: true, baseline: true, target: true, measurements: true, name: true } },
      epic: {
        select: { id: true, title: true, valueStream: { select: { name: true } } },
      },
    },
  });
  if (links.length === 0) return [];

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

  // Links je Epic sammeln (nur KPI-getriebene tragen zur Kaskade bei).
  const byEpic = new Map<
    string,
    { title: string; valueStreamName: string | null; inputs: EpicGoalLinkInput[] }
  >();
  for (const l of links) {
    let entry = byEpic.get(l.epicId);
    if (!entry) {
      entry = {
        title: l.epic.title,
        valueStreamName: l.epic.valueStream?.name ?? null,
        inputs: [],
      };
      byEpic.set(l.epicId, entry);
    }
    if (l.kpi && l.conversionFactor != null) {
      entry.inputs.push({
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
  }

  const nonZero = (v: UnitValue) => v.planned !== 0 || v.realized !== 0;
  const out: EpicGoalContribution[] = [];
  for (const [epicId, entry] of byEpic) {
    const agg = aggregateEpicContribution(epicTopGoalBenefits(entry.inputs, nodesById));
    const recurring = agg.recurring.filter(nonZero);
    const oneTime = agg.oneTime.filter(nonZero);
    if (recurring.length || oneTime.length) {
      out.push({
        epicId,
        title: entry.title,
        valueStreamName: entry.valueStreamName,
        recurring,
        oneTime,
      });
    }
  }
  return out;
}

/**
 * Der Plan dieser Verknüpfung: der festgeschriebene Umrechnungsfaktor, bewertet
 * an den festgeschriebenen Mengen-Größen der treibenden KPI. Fehlt der
 * Schnappschuss der Verknüpfung, gibt es keinen Plan-Bezug — dann `null`, damit
 * die Oberfläche das benennen kann, statt eine Abweichung von null zu zeigen.
 * Fehlt nur der KPI-Schnappschuss (bei gemeinsamer Abnahme unmöglich), gilt
 * hilfsweise der Live-Stand der Menge.
 */
function linkPlanTerms(l: {
  planSnapshot: unknown;
  kpi: { baseline: unknown; target: unknown; planSnapshot: unknown } | null;
}): KpiValuationTerms | null {
  const kpiPlan = parsePlanSnapshot(l.kpi?.planSnapshot);
  return parsePlanSnapshot(l.planSnapshot, {
    baseline: kpiPlan?.baseline ?? toFloat(l.kpi?.baseline),
    target: kpiPlan?.target ?? toFloat(l.kpi?.target),
  });
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
