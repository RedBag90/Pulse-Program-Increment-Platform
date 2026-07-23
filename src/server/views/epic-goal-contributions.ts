import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { horizonShare, kpiAchievement, type KpiInput } from "@/domain/goals-rollup";

/**
 * Liefert die strategischen Bezuege eines Epics fuer den Cross-Modul-Badge
 * (Konzept V10): direkt verlinkte Themes + Key Results, in die KPIs des Epics
 * via Bridge-Tabelle einzahlen. Jeder KR-Eintrag bringt den €-Beitrag, den
 * THIS Epic faktisch leistet — also nur den KPI-Anteil, nicht die ganze
 * KR-Realized-Summe.
 *
 * Tenant-Scope wird ueber die uebergebene Prisma-Instanz erzwungen (RLS),
 * zusaetzlich filtern wir explizit nach `tenantId`.
 */

export interface EpicGoalKrContribution {
  krId: string;
  krTitle: string;
  /** Parent-Theme (= im Schema „Objective") — nach Hierarchie-Vereinfachung
   *  die einzige sichtbare Ebene oberhalb des KR. */
  themeId: string;
  themeTitle: string;
  /** € Beitrag, der direkt aus den KPIs dieses Epics stammt (Realized). */
  contributionRealized: number;
  /** Soll-€ des KRs als Vergleichsanker (Planned des gesamten KRs). */
  krPlanned: number;
}

export interface EpicGoalContributions {
  /** KRs, die per KPI an das Epic zahlen. */
  krContributions: EpicGoalKrContribution[];
}

export async function loadEpicGoalContributions(
  db: PrismaClient,
  principal: Principal,
  epicId: string,
): Promise<EpicGoalContributions> {
  const { tenantId } = principal;

  // 2) Alle KPIs des Epics
  const kpis = await db.kpi.findMany({
    where: { tenantId, initiativeId: epicId },
    select: {
      id: true,
      baseline: true,
      target: true,
      measurements: true,
      valuePerUnit: true,
    },
  });
  if (kpis.length === 0) {
    return { krContributions: [] };
  }

  // 3) KR-Beitraege fuer diese KPIs (Bridge-Tabelle); Parent = Objective
  //    (in der UI „Theme" nach Hierarchie-Vereinfachung)
  const contribs = await db.krKpiContribution.findMany({
    where: { tenantId, kpiId: { in: kpis.map((k) => k.id) } },
    include: {
      objective: {
        select: {
          id: true,
          title: true,
          parent: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (contribs.length === 0) {
    return { krContributions: [] };
  }

  // 4) Horizont-Share fuer die Run-Rate-Linse
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { dashboardHorizonEnd: true },
  });
  const now = new Date();
  const horizonStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const horizonEnd =
    tenant?.dashboardHorizonEnd ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const share = horizonShare(now, horizonStart, horizonEnd);

  // 5) KPI-Inputs aufbauen (gleiche Form wie ziele-view, damit kpiAchievement passt)
  const kpisById = new Map<string, KpiInput>();
  for (const k of kpis) {
    kpisById.set(k.id, {
      id: k.id,
      baseline: toFloat(k.baseline),
      target: toFloat(k.target),
      current: latestMeasurement(k.measurements),
      valuePerUnit: toFloat(k.valuePerUnit),
    });
  }

  // 6) Aggregation pro KR — wir summieren NUR die KPI-Beitraege aus diesem Epic.
  //    Damit zeigt der Badge „dein Epic traegt €X" und nicht „dieser KR ist €Y wert".
  const byKr = new Map<string, EpicGoalKrContribution>();
  for (const c of contribs) {
    const kpi = kpisById.get(c.kpiId);
    if (!kpi) continue;
    const ach = kpiAchievement(kpi);
    const span = (kpi.target ?? 0) - (kpi.baseline ?? 0);
    const vpu = toFloat(c.valuePerUnitOverride) ?? kpi.valuePerUnit ?? 0;
    const weight = Number(c.weight);
    const realized = ach != null && vpu ? ach * vpu * span * weight * share : 0;

    if (!c.objective) continue;
    const node = c.objective;
    const existing = byKr.get(node.id);
    if (existing) {
      existing.contributionRealized += realized;
    } else {
      byKr.set(node.id, {
        krId: node.id,
        krTitle: node.title,
        themeId: node.parent?.id ?? node.id,
        themeTitle: node.parent?.title ?? node.title,
        contributionRealized: realized,
        krPlanned: 0,
      });
    }
  }

  // 7) krPlanned pro KR — gesamte Soll-€-Summe ueber alle Contributions des KRs
  //    (Vergleichswert; nicht epic-spezifisch, sondern Theme-weit)
  const krIds = Array.from(byKr.keys());
  if (krIds.length > 0) {
    const allContribs = await db.krKpiContribution.findMany({
      where: { tenantId, objectiveId: { in: krIds } },
      include: {
        kpi: { select: { id: true, baseline: true, target: true, valuePerUnit: true } },
      },
    });
    const plannedByKr = new Map<string, number>();
    for (const c of allContribs) {
      if (!c.objectiveId) continue;
      const span = (toFloat(c.kpi.target) ?? 0) - (toFloat(c.kpi.baseline) ?? 0);
      const vpu = toFloat(c.valuePerUnitOverride) ?? toFloat(c.kpi.valuePerUnit) ?? 0;
      const planned = vpu * span * Number(c.weight) * share;
      plannedByKr.set(c.objectiveId, (plannedByKr.get(c.objectiveId) ?? 0) + planned);
    }
    for (const [krId, entry] of byKr) {
      entry.krPlanned = plannedByKr.get(krId) ?? 0;
    }
  }

  return {
    krContributions: Array.from(byKr.values()).sort(
      (a, b) => b.contributionRealized - a.contributionRealized,
    ),
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
