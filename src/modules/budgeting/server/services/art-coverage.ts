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
import { previousCycles } from "@/modules/budgeting/domain/cycle";
import {
  deriveJobSizeRate,
  loadInEuro,
  RATE_WINDOW,
  type ThroughputCycle,
} from "@/modules/budgeting/domain/art-throughput";
import { aggregateArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import { emptyPointCell, type PointCell } from "@/modules/budgeting/domain/capacity-plan";
import {
  CAPACITY_BUCKETS,
  featureCapacityBucket,
  isFeatureType,
  type CapacityBucket,
} from "@/modules/work/domain/portfolio-guardrails";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import { getTenantBudgetSettings } from "@/modules/budgeting/server/services/tenant-budget-settings";

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
        // Für die Herkunft des Nenners: hängt dieses Feature an einem Epic?
        parentId: true,
        // Guardrail 2: der Arbeitstyp teilt die Last in ihre drei Eimer.
        featureType: true,
        pi: { select: { startDate: true, endDate: true } },
      },
    }),
    getTenantBudgetSettings(db, tenantId),
  ]);

  // Zähler: das Primitiv, nicht von Hand.
  const zuLast = (f: (typeof features)[number]) => ({
    artId,
    jobSize: f.wsjfJobSize ?? 0,
    piStart: f.pi?.startDate ?? null,
  });
  const planned = aggregateArtFeatureLoad([artId], features.map(zuLast))[0]?.byPeriod[cycleKey] ?? {
    jobSize: 0,
    count: 0,
  };
  const plannedJobSize = planned.jobSize;
  const plannedCount = planned.count;

  /**
   * Derselbe Zähler, eingeengt auf Features **ohne Epic** — die eigenständige
   * Arbeit dieses ARTs. Dasselbe Primitiv ein zweites Mal statt einer
   * handgeschriebenen Zweitrechnung: sonst gäbe es zwei Stellen, an denen
   * „eingeplant in diesem Halbjahr" definiert wird, und sie würden driften.
   *
   * Sie ist ein **Teil** von `plannedJobSize`, kein Abzug: das ART-Budget
   * finanziert alles, was das ART tut.
   */
  const plannedStandalone = aggregateArtFeatureLoad(
    [artId],
    features.filter((f) => f.parentId === null).map(zuLast),
  )[0]?.byPeriod[cycleKey] ?? { jobSize: 0, count: 0 };

  /**
   * **Dieselbe Rechnung je Arbeitstyp** — die Grundlage von Guardrail 2.
   *
   * Wieder das Primitiv, einmal je Eimer, statt einer Schleife, die „eingeplant
   * in diesem Halbjahr" ein zweites Mal definiert. Der Preis ist ein Durchlauf
   * mehr über eine Liste, die ohnehin im Speicher liegt; der Gewinn ist, dass
   * die Summe der Eimer und `plannedJobSize` nicht auseinanderlaufen können.
   */
  const lastFuer = (pruefe: (t: string | null) => boolean): PointCell =>
    aggregateArtFeatureLoad([artId], features.filter((f) => pruefe(f.featureType)).map(zuLast))[0]
      ?.byPeriod[cycleKey] ?? emptyPointCell();

  const plannedByBucket = Object.fromEntries(
    CAPACITY_BUCKETS.map((bucket) => [
      bucket,
      lastFuer((t) => isFeatureType(t) && featureCapacityBucket(t) === bucket),
    ]),
  ) as Record<CapacityBucket, PointCell>;

  const plannedUnclassified = lastFuer((t) => !isFeatureType(t));

  // Nenner: fertiggestellte Features je Abschluss-Halbjahr.
  const doneByCycle = new Map<
    string,
    { jobSize: number; count: number; standaloneJobSize: number; standaloneCount: number }
  >();
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
    const cur = doneByCycle.get(key) ?? {
      jobSize: 0,
      count: 0,
      standaloneJobSize: 0,
      standaloneCount: 0,
    };
    const standalone = f.parentId === null;
    doneByCycle.set(key, {
      jobSize: cur.jobSize + jobSize,
      count: cur.count + 1,
      standaloneJobSize: cur.standaloneJobSize + (standalone ? jobSize : 0),
      standaloneCount: cur.standaloneCount + (standalone ? 1 : 0),
    });
  }

  /**
   * **Das Fenster sind Halbjahre, keine Erfolge.**
   *
   * Bis September 2026 entstand diese Liste aus `doneByCycle` — also nur aus
   * Halbjahren, in denen etwas fertig wurde. Ein Halbjahr, in dem Geld floss und
   * nichts abgeschlossen wurde, tauchte gar nicht auf. Gemessen an „Shared
   * Services & Automation": 255.000 € aus zwei aufeinanderfolgenden Halbjahren
   * ohne einen einzigen Abschluss fielen aus der Rechnung, und der Satz kam aus
   * einem einzelnen, ein Jahr alten Halbjahr.
   *
   * Der Satz soll aber beantworten „was hat ein Punkt bei diesem Zug zuletzt
   * gekostet". Wer ein Halbjahr lang Geld ausgibt und nichts liefert, hat teure
   * Punkte — nicht gar keine.
   *
   * Die letzten `RATE_WINDOW` Halbjahre **vor** dem gewählten: der laufende ist
   * nicht abgeschlossen und zählt nie mit.
   */
  const cycles: ThroughputCycle[] = previousCycles(cycleKey, RATE_WINDOW).map((key) => {
    const v = doneByCycle.get(key);
    return {
      cycleKey: key,
      budget: allocatedByCycle[key] ?? 0,
      jobSize: v?.jobSize ?? 0,
      featureCount: v?.count ?? 0,
      standaloneJobSize: v?.standaloneJobSize ?? 0,
      standaloneFeatureCount: v?.standaloneCount ?? 0,
    };
  });

  const rate = deriveJobSizeRate({
    cycles,
    tenantDefault: tenant.costPerJobSizePoint,
    undatedFeatures: undated,
    placeholderJobSize: placeholder,
  });

  const loadEuro = loadInEuro(plannedJobSize, rate);
  const allocated = allocatedByCycle[cycleKey] ?? 0;

  return {
    plannedJobSize,
    featureCount: plannedCount,
    plannedStandalone: { jobSize: plannedStandalone.jobSize, count: plannedStandalone.count },
    plannedByBucket,
    plannedUnclassified,
    rate,
    loadEuro,
    allocated,
    gap: loadEuro == null ? null : loadEuro - allocated,
  };
}
