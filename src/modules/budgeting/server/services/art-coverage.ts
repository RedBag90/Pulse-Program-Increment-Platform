/**
 * **Die Deckung mehrerer ARTs** — einmal geladen, je ART und Halbjahr gerechnet.
 *
 * Bis September 2026 hiess das `loadArtCoverage(db, tenantId, artId, cycleKey,
 * allocatedByCycle, today, burnWindow)`: sieben Positionen, das Budget musste
 * der Aufrufer vorher selbst laden, und jeder Aufruf las die Features seines
 * ARTs neu. Der Kapazitätsplan rief es je ART **und je Halbjahr** — dieselben
 * Features mehrmals. Jetzt lädt eine Funktion Features, Schätzungen, Vorgaben
 * und das Veränderungsgeld für alle ARTs, und die Rechnung ist rein
 * (`domain/art-coverage.ts`).
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import { artCoverage, type CoverageFeature } from "@/modules/budgeting/domain/art-coverage";
import type { BurnWindow } from "@/modules/budgeting/domain/job-size-burn";
import { loadChangeMoney } from "@/modules/budgeting/server/services/change-money";

export interface ArtCoverageSource {
  /**
   * Last gegen Deckung eines ARTs im Halbjahr `cycleKey`. Mit `burn` dazu der
   * Job-Size-Verlauf der geltenden Kachel (`BudgetStichtag.applied`) — Geld,
   * Satz und Ist alle auf der Kachel.
   */
  coverage(
    artId: string,
    cycleKey: string,
    burn?: { tile: BurnWindow; today: Date } | null,
  ): ArtCoverage;
}

export async function loadArtCoverages(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: readonly string[],
): Promise<ArtCoverageSource> {
  const [features, arts, money] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: { in: [...artIds] },
      },
      select: {
        artId: true,
        status: true,
        completedAt: true,
        wsjfJobSize: true,
        parentId: true,
        featureType: true,
        pi: { select: { startDate: true, endDate: true } },
      },
    }),
    // Die Schätzung je ART — greift nur ohne ableitbaren Satz.
    db.art.findMany({
      where: { tenantId, id: { in: [...artIds] } },
      select: { id: true, jobSizeRateEstimate: true },
    }),
    loadChangeMoney(db, tenantId),
  ]);

  const featuresOf = new Map<string, CoverageFeature[]>(artIds.map((id) => [id, []]));
  for (const f of features) if (f.artId) featuresOf.get(f.artId)?.push(f);
  const estimateOf = new Map(
    arts.map((a) => [a.id, a.jobSizeRateEstimate != null ? Number(a.jobSizeRateEstimate) : null]),
  );

  return {
    coverage: (artId, cycleKey, burn = null) =>
      artCoverage({
        artId,
        features: featuresOf.get(artId) ?? [],
        cycleKey,
        allocatedByCycle: money.artTotalByCycle(artId),
        artEstimate: estimateOf.get(artId) ?? null,
        burn,
      }),
  };
}
