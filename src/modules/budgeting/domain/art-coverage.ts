/**
 * **Last gegen Deckung eines ARTs** — was seine eingeplanten Features in Geld
 * kosten würden, gegen das, was ihm zugeteilt ist. Dazu der Job-Size-Verlauf
 * der geltenden Kachel.
 *
 * Rein: die Features, das Veränderungsgeld je Halbjahr und die Vorgaben kommen
 * herein (`server/services/art-coverage.ts` lädt sie einmal für alle ARTs).
 *
 * **Der Verlauf rechnet ganz auf der Kachel.** Bis September 2026 nahm er sein
 * Budget von der Kachel, seinen €-Satz aber aus den Halbjahren vor dem
 * *Umschalter*. Stand der auf dem nächsten Halbjahr, verschob sich das Fenster
 * des Satzes, und Plan-Linie und Kachel passten nicht mehr zusammen. Jetzt
 * kommt der Satz des Verlaufs aus den Halbjahren vor der Kachel.
 */

import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import { previousCycles } from "@/modules/budgeting/domain/cycle";
import {
  deriveJobSizeRate,
  loadInEuro,
  RATE_WINDOW,
  type JobSizeRate,
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
import {
  jobSizeBurn,
  type BurnWindow,
  type Completion,
} from "@/modules/budgeting/domain/job-size-burn";

/** Ein Feature, so weit die Deckung es kennen muss. */
export interface CoverageFeature {
  status: string;
  completedAt: Date | null;
  wsjfJobSize: number | null;
  /** Hängt es an einem Epic? `null` = eigenständige Arbeit des ARTs. */
  parentId: string | null;
  /** Guardrail 2: der Arbeitstyp teilt die Last in ihre drei Eimer. */
  featureType: string | null;
  pi: { startDate: Date; endDate: Date } | null;
}

export interface CoverageInput {
  artId: string;
  features: readonly CoverageFeature[];
  /** Das gewählte Halbjahr — Last, Deckung, Lücke. */
  cycleKey: string;
  /** Veränderungsgeld je Halbjahr (Portfolio plus Rahmen). */
  allocatedByCycle: Record<string, number>;
  tenantDefault: number | null;
  artEstimate: number | null;
  /** Der Job-Size-Verlauf: die geltende Kachel und der heutige Tag. Ohne ihn kein Verlauf. */
  burn?: { tile: BurnWindow; today: Date } | null;
}

type Done = { jobSize: number; count: number; standaloneJobSize: number; standaloneCount: number };

export function artCoverage(input: CoverageInput): ArtCoverage {
  const { artId, features, cycleKey, allocatedByCycle } = input;

  // Zähler: eingeplant im gewählten Halbjahr — das Primitiv, nicht von Hand.
  const zuLast = (f: CoverageFeature) => ({
    artId,
    jobSize: f.wsjfJobSize ?? 0,
    piStart: f.pi?.startDate ?? null,
  });
  const lastFuer = (auswahl: readonly CoverageFeature[]): PointCell =>
    aggregateArtFeatureLoad([artId], auswahl.map(zuLast))[0]?.byPeriod[cycleKey] ??
    emptyPointCell();

  const planned = lastFuer(features);
  // Derselbe Zähler für Features **ohne Epic** — ein Teil der Last, kein Abzug.
  const plannedStandalone = lastFuer(features.filter((f) => f.parentId === null));
  // Je Arbeitstyp — die Summe der Eimer und die Last können nicht auseinanderlaufen.
  const plannedByBucket = Object.fromEntries(
    CAPACITY_BUCKETS.map((bucket) => [
      bucket,
      lastFuer(
        features.filter(
          (f) => isFeatureType(f.featureType) && featureCapacityBucket(f.featureType) === bucket,
        ),
      ),
    ]),
  ) as Record<CapacityBucket, PointCell>;
  const plannedUnclassified = lastFuer(features.filter((f) => !isFeatureType(f.featureType)));

  /**
   * Nenner: fertiggestellte Features je **Abschluss**-Halbjahr. Datierung wie
   * bei `buildEpicStageTimeline`: `completedAt`, ersatzweise das PI-Ende.
   * Features ohne beides fallen heraus und werden gezählt.
   */
  const doneByCycle = new Map<string, Done>();
  const completions: Completion[] = [];
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
    completions.push({ at, jobSize });
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
   * **Der Satz vor einem Halbjahr** — die letzten `RATE_WINDOW` Halbjahre davor,
   * als Zeiträume, nicht als Erfolge: ein Halbjahr mit Geld und ohne Abschluss
   * macht die Punkte teuer, nicht unsichtbar.
   */
  const rateBefore = (key: string): JobSizeRate =>
    deriveJobSizeRate({
      cycles: previousCycles(key, RATE_WINDOW).map(
        (k): ThroughputCycle => ({
          cycleKey: k,
          budget: allocatedByCycle[k] ?? 0,
          jobSize: doneByCycle.get(k)?.jobSize ?? 0,
          featureCount: doneByCycle.get(k)?.count ?? 0,
          standaloneJobSize: doneByCycle.get(k)?.standaloneJobSize ?? 0,
          standaloneFeatureCount: doneByCycle.get(k)?.standaloneCount ?? 0,
        }),
      ),
      tenantDefault: input.tenantDefault,
      artEstimate: input.artEstimate,
      undatedFeatures: undated,
      placeholderJobSize: placeholder,
    });

  const rate = rateBefore(cycleKey);
  const loadEuro = loadInEuro(planned.jobSize, rate);
  const allocated = allocatedByCycle[cycleKey] ?? 0;

  // Der Verlauf: Geld, Satz und Abschlüsse alle auf der Kachel.
  const tile = input.burn?.tile ?? null;
  const cycleCompletions = tile
    ? completions.filter((c) => c.at >= tile.start && c.at < tile.end)
    : [];
  const burn =
    tile && input.burn
      ? jobSizeBurn({
          window: tile,
          allocated: allocatedByCycle[tile.cycleKey] ?? 0,
          rate: (tile.cycleKey === cycleKey ? rate : rateBefore(tile.cycleKey)).rate,
          completions: cycleCompletions,
          today: input.burn.today,
        })
      : null;

  return {
    plannedJobSize: planned.jobSize,
    featureCount: planned.count,
    plannedStandalone: { jobSize: plannedStandalone.jobSize, count: plannedStandalone.count },
    plannedByBucket,
    plannedUnclassified,
    rate,
    loadEuro,
    allocated,
    gap: loadEuro == null ? null : loadEuro - allocated,
    burn,
    cycleCompletions,
  };
}
