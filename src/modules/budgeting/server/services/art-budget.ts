import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { budgetPlusLoadPeriods } from "@/modules/budgeting/domain/period-window";
import {
  aggregateArtFeatureLoad,
  type ArtFeatureLoad,
} from "@/modules/budgeting/domain/art-budget";
import { getValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";

export interface ArtBudgetByPeriod {
  artId: string;
  name: string;
  /** Finance's budget allocation per half-year. */
  budgetByPeriod: Record<string, number>;
  /** Feature count + Σ Job Size per half-year + backlog. */
  load: ArtFeatureLoad;
}

export interface ArtBudgetBreakdown {
  /** Half-year columns: the VS budget-plan periods ∪ the periods features' PIs fall in. */
  periods: { key: string; label: string }[];
  /** The Value Stream's budget per half-year — what the ARTs draw against. */
  vsByPeriod: Record<string, number>;
  arts: ArtBudgetByPeriod[];
}

/**
 * ART-Budgets eines Wertstroms + die Feature-Last, je Halbjahr.
 *
 * **Vollständig abgeleitet.** Das Budget eines ART ist die Summe der final
 * zugeteilten Beträge seiner Epics, gruppiert nach dem Halbjahr der Kachel, aus
 * der die Zuteilung stammt. Früher stand daneben eine handgepflegte
 * `ArtBudget`-Tabelle — zwei Zahlen für dieselbe Sache, die auseinanderliefen.
 */
export async function getArtBudgetBreakdown(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
): Promise<ArtBudgetBreakdown> {
  const [vsBudget, arts] = await Promise.all([
    getValueStreamBudget(db, tenantId, valueStreamId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const vsByPeriod = vsBudget.budget?.byPeriod ?? {};
  const artIds = arts.map((a) => a.id);

  // Das ART-Budget je Halbjahr: die finalen Beträge der Epic-Kandidaten dieses
  // ART, gruppiert nach dem Zyklus der Kachel, die sie zugeteilt hat.
  const finals = await db.budgetCandidate.findMany({
    where: { tenantId, kind: "epic", artId: { in: artIds }, finalAmount: { not: null } },
    select: { artId: true, finalAmount: true, round: { select: { cycleKey: true } } },
  });
  const budgetByArt = new Map<string, Record<string, number>>();
  for (const f of finals) {
    if (!f.artId) continue;
    const byPeriod = budgetByArt.get(f.artId) ?? {};
    const key = f.round.cycleKey;
    byPeriod[key] = (byPeriod[key] ?? 0) + Number(f.finalAmount);
    budgetByArt.set(f.artId, byPeriod);
  }

  const features = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      artId: { in: artIds },
    },
    select: { artId: true, wsjfJobSize: true, pi: { select: { startDate: true } } },
  });

  const loads = new Map(
    aggregateArtFeatureLoad(
      artIds,
      features.map((f) => ({
        artId: f.artId ?? "",
        piStart: f.pi?.startDate ?? null,
        jobSize: f.wsjfJobSize ?? 0,
      })),
    ).map((l) => [l.artId, l]),
  );

  // Columns: the budget-plan periods ∪ any half-year a feature's PI sits in —
  // the named rule lives in the pure `period-window` seam.
  const periods = budgetPlusLoadPeriods(
    [...new Set([...vsBudget.periods.map((p) => p.key), ...finals.map((f) => f.round.cycleKey)])],
    features.flatMap((f) => (f.pi ? [f.pi.startDate] : [])),
  );

  const rows: ArtBudgetByPeriod[] = arts.map((a) => ({
    artId: a.id,
    name: a.name,
    budgetByPeriod: budgetByArt.get(a.id) ?? {},
    // `aggregateArtFeatureLoad(artIds, …)` guarantees exactly one entry per id
    // in `artIds` (= `arts.map(a => a.id)`), so this lookup is always present.
    load: loads.get(a.id)!,
  }));

  return { periods, vsByPeriod, arts: rows };
}
