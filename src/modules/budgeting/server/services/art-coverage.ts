/**
 * Last gegen Deckung eines ARTs: was seine eingeplanten Features in Geld kosten
 * würden, gegen das, was ihm zugeteilt ist.
 *
 * Lag bis zum Zerlegen von `art-budget-detail.ts` in dieser Datei. Es ist ein
 * eigener Vorgang mit eigenen Abfragen und eigener Aggregation — der Falter des
 * Budget-Reiters braucht sein Ergebnis, nicht seine Rechnung.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import { compareCycles } from "@/modules/budgeting/domain/cycle";
import {
  deriveJobSizeRate,
  loadInEuro,
  type ThroughputCycle,
} from "@/modules/budgeting/domain/art-throughput";
import { aggregateArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";

/**
 * Last gegen Deckung eines ARTs im gewählten Halbjahr.
 *
 * Zwei Aggregationen, weil es zwei Fragen sind:
 *
 *  - **Zähler** — was ist im gewählten Halbjahr *eingeplant*? Das ist genau
 *    `aggregateArtFeatureLoad` (nach geplanter PI, ohne Status-Filter), und es
 *    wird auch genau von dort geholt. Bis zum Zerlegen stand hier eine
 *    handgeschriebene Kopie derselben Rechnung — zwei Stellen, die dieselbe
 *    Zahl unterschiedlich hätten werden lassen können.
 *  - **Nenner** — was wurde *fertig*, gebucketet nach seinem
 *    **Abschluss**-Halbjahr? Dafür gibt es kein Primitiv; es bleibt die Schleife.
 *
 * Datierungsregel wie bei `buildEpicStageTimeline`: Actual vor Estimate —
 * `completedAt`, ersatzweise das Ende der zugewiesenen PI. Features ohne beides
 * fallen aus dem Nenner **und werden gezählt**, damit die Zahl ihre Lücke kennt.
 */
export async function loadArtCoverage(
  db: PrismaClient,
  tenantId: TenantId,
  artId: string,
  cycleKey: string,
  allocatedByCycle: Record<string, number>,
): Promise<ArtCoverage> {
  const [features, tenant] = await Promise.all([
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.FEATURE, deletedAt: null, artId },
      select: {
        status: true,
        completedAt: true,
        wsjfJobSize: true,
        pi: { select: { startDate: true, endDate: true } },
      },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { costPerJobSizePoint: true } }),
  ]);

  // Zähler: das Primitiv, nicht von Hand.
  const planned = aggregateArtFeatureLoad(
    [artId],
    features.map((f) => ({
      artId,
      jobSize: f.wsjfJobSize ?? 0,
      piStart: f.pi?.startDate ?? null,
    })),
  )[0]?.byPeriod[cycleKey] ?? { jobSize: 0, count: 0 };
  const plannedJobSize = planned.jobSize;
  const plannedCount = planned.count;

  // Nenner: fertiggestellte Features je Abschluss-Halbjahr.
  const doneByCycle = new Map<string, { jobSize: number; count: number }>();
  let undated = 0;
  let placeholder = 0;

  for (const f of features) {
    const jobSize = f.wsjfJobSize ?? 0;
    if (f.wsjfJobSize === 3) placeholder += 1;
    if (f.status !== "completed") continue;

    const at = f.completedAt ?? f.pi?.endDate ?? null;
    if (at == null) {
      undated += 1;
      continue;
    }
    const key = halfYearKey(at);
    const cur = doneByCycle.get(key) ?? { jobSize: 0, count: 0 };
    doneByCycle.set(key, { jobSize: cur.jobSize + jobSize, count: cur.count + 1 });
  }

  // Nur Zyklen, die vor dem gewählten liegen — der laufende ist nicht abgeschlossen.
  const cycles: ThroughputCycle[] = [...doneByCycle.entries()]
    .filter(([key]) => compareCycles(key, cycleKey) < 0)
    .map(([key, v]) => ({
      cycleKey: key,
      budget: allocatedByCycle[key] ?? 0,
      jobSize: v.jobSize,
      featureCount: v.count,
    }));

  const rate = deriveJobSizeRate({
    cycles,
    tenantDefault: tenant?.costPerJobSizePoint != null ? Number(tenant.costPerJobSizePoint) : null,
    undatedFeatures: undated,
    placeholderJobSize: placeholder,
  });

  const loadEuro = loadInEuro(plannedJobSize, rate);
  const allocated = allocatedByCycle[cycleKey] ?? 0;

  return {
    plannedJobSize,
    featureCount: plannedCount,
    rate,
    loadEuro,
    allocated,
    gap: loadEuro == null ? null : loadEuro - allocated,
  };
}
