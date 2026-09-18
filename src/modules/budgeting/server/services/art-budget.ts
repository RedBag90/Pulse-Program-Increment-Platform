import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import {
  readBudgetCandidates,
  readRtbItems,
  readSolutions,
} from "@/modules/budgeting/server/services/budget-reads";
import { resolveRtbToArts } from "@/modules/budgeting/domain/rtb-art-resolution";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
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
  /**
   * **Betriebsgeld dieses ARTs je Halbjahr** (REQ-9) — aufgelöst über die
   * Position, ihre Solution oder gleichmässig geschlüsselt.
   *
   * **Zählt nirgends in die Deckung.** `allocated`, die Lücke und der €-Satz je
   * Job-Size-Punkt bleiben Veränderungsgeld (REQ-10). Flösse Betriebsgeld dort
   * hinein, spränge die Ampel auf „gedeckt", obwohl kein Euro davon ein Feature
   * bezahlt — und der Satz stiege, weil sein Zähler wüchse und sein Nenner
   * (Job Size) nicht.
   */
  operatingPerCycle: number;
}

export interface ArtBudgetBreakdown {
  /** Half-year columns: the VS budget-plan periods ∪ the periods features' PIs fall in. */
  periods: { key: string; label: string }[];
  /** The Value Stream's budget per half-year — what the ARTs draw against. */
  vsByPeriod: Record<string, number>;
  arts: ArtBudgetByPeriod[];
  /**
   * Betriebsgeld, das **keinem** ART zuzuordnen war — heute genau die
   * Positionen an einer Solution ohne ART. Die Fläche weist es aus, statt es
   * verschwinden zu lassen; es ist zugleich die Begründung dafür, dass
   * `solutions.art_id` zur Pflicht wird.
   */
  operatingUnresolved: number;
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
  const [vsBudget, arts, candidates, rtbItems, solutions] = await Promise.all([
    getValueStreamBudget(db, tenantId, valueStreamId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Die geteilten Lader (REQ-5). Die Kandidaten standen hier als eigene,
    // eingeengte Abfrage **nach** dem `Promise.all` — also eine dritte
    // Rundreise, die auf die ersten beiden wartete, obwohl sie von ihnen nichts
    // braucht. Positionen und Solutions liest die Seite ohnehin.
    readBudgetCandidates(db, tenantId),
    readRtbItems(db, tenantId),
    readSolutions(db, tenantId),
  ]);

  const vsByPeriod = vsBudget.budget?.byPeriod ?? {};
  const artIds = arts.map((a) => a.id);
  const ofThisStream = new Set(artIds);

  // Das ART-Budget je Halbjahr: die finalen Beträge der Epic-Kandidaten dieses
  // ART, gruppiert nach dem Zyklus der Kachel, die sie zugeteilt hat.
  const finals = candidates.filter(
    (c) =>
      c.kind === "epic" && c.finalAmount != null && c.artId != null && ofThisStream.has(c.artId),
  );
  const budgetByArt = new Map<string, Record<string, number>>();
  for (const f of finals) {
    if (!f.artId) continue;
    const byPeriod = budgetByArt.get(f.artId) ?? {};
    byPeriod[f.cycleKey] = (byPeriod[f.cycleKey] ?? 0) + (f.finalAmount ?? 0);
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
    [...new Set([...vsBudget.periods.map((p) => p.key), ...finals.map((f) => f.cycleKey)])],
    features.flatMap((f) => (f.pi ? [f.pi.startDate] : [])),
  );

  /**
   * **Das Betriebsgeld je ART** (REQ-9).
   *
   * Nur `run`: der ART-Rahmen (`art_change`) ist der andere Geldstrang und hat
   * seinen eigenen Platz im Reiter „Betrieb". Beide in einer Spalte wären genau
   * die Vermischung, gegen die das Vokabular der Spec geschrieben ist.
   *
   * Der Betrag ist der **Halbjahres**-Betrag — dieselbe Grösse wie eine
   * Periodenspalte, nur eben in jedem Halbjahr dieselbe, solange die Position
   * unverändert läuft. Deshalb steht er als **eine** Spalte und nicht N-mal.
   */
  const operating = resolveRtbToArts(
    rtbItems
      .filter((i) => i.valueStreamId === valueStreamId && i.active && !isChangeKind(i.kind))
      .map((i) => ({
        id: i.id,
        artId: i.artId,
        solutionId: i.solutionId,
        amount: rtbCycleAmount(i.plannedAmount, i.interval),
      })),
    Object.fromEntries(
      solutions.filter((s) => s.valueStreamId === valueStreamId).map((s) => [s.id, s.artId]),
    ),
    artIds,
  );

  const rows: ArtBudgetByPeriod[] = arts.map((a) => ({
    artId: a.id,
    name: a.name,
    budgetByPeriod: budgetByArt.get(a.id) ?? {},
    // `aggregateArtFeatureLoad(artIds, …)` guarantees exactly one entry per id
    // in `artIds` (= `arts.map(a => a.id)`), so this lookup is always present.
    load: loads.get(a.id)!,
    operatingPerCycle: operating.byArt[a.id] ?? 0,
  }));

  return {
    periods,
    vsByPeriod,
    arts: rows,
    operatingUnresolved: operating.unresolved.reduce((sum, u) => sum + u.amount, 0),
  };
}
