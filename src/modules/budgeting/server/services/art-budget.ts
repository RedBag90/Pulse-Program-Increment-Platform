import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { loadChangeMoney } from "@/modules/budgeting/server/services/change-money";
import {
  readRtbItems,
  readRtbAwards,
  readSolutions,
} from "@/modules/budgeting/server/services/budget-reads";
import { resolveRtbToArts } from "@/modules/budgeting/domain/rtb-art-resolution";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
import { budgetPlusLoadPeriods } from "@/modules/budgeting/domain/period-window";
import { aggregateArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import { getValueStreamBudgets } from "@/modules/budgeting/server/services/budgeting";
import {
  buildArtGridModel,
  type ArtGridModel,
  type ArtGridRow,
} from "@/modules/budgeting/server/views/art-budget-breakdown";

/**
 * **Die Verteil-Matrix eines Wertstroms** — ART-Budgets und Feature-Last je
 * Halbjahr, fertig gefaltet (`buildArtGridModel`).
 *
 * Bis September 2026 waren das zwei Funktionen, jede der einzige Aufrufer der
 * anderen: `getArtBudgetBreakdown` lud, `loadArtGridModel` benannte `arts` in
 * `rows` um und reichte weiter — aus einer Datei, die sich „rein, kein I/O"
 * nannte.
 *
 * **Vollständig abgeleitet.** Das Budget eines ART ist die Summe der final
 * zugeteilten Beträge seiner Epics, gruppiert nach dem Halbjahr der Kachel, aus
 * der die Zuteilung stammt. Früher stand daneben eine handgepflegte
 * `ArtBudget`-Tabelle — zwei Zahlen für dieselbe Sache, die auseinanderliefen.
 */
export async function loadArtGridModel(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
  /**
   * Das gewählte Halbjahr — **nur** für die Betriebsspalte. Sie zeigt einen
   * Betrag, keine Reihe, und braucht deshalb ein Halbjahr, um „zugesprochen"
   * überhaupt beantworten zu können. Fehlt es, bleibt es beim geplanten Betrag.
   */
  cycleKey?: string,
): Promise<ArtGridModel> {
  const [vsBudgets, arts, money, rtbItems, rtbAwards, solutions] = await Promise.all([
    getValueStreamBudgets(db, tenantId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Portfolio-Geld und ART-Rahmen je ART und Halbjahr: die Faltung des
    // Veränderungsgeldes, dieselbe Quelle wie Funding-Snapshot und ART-Reiter.
    loadChangeMoney(db, tenantId),
    readRtbItems(db, tenantId),
    // Über alle Halbjahre — genau dafür ist der Lader gebaut. Der Rahmen je
    // Spalte kommt daraus, die Betriebsspalte schneidet ihr Halbjahr heraus.
    readRtbAwards(db, tenantId),
    readSolutions(db, tenantId),
  ]);

  const epicByPeriod =
    vsBudgets.valueStreams.find((v) => v.valueStreamId === valueStreamId)?.byPeriod ?? {};
  const artIds = arts.map((a) => a.id);

  // Das Veränderungsgeld je ART und Halbjahr: Portfolio-Zuteilung und
  // ART-Rahmen getrennt, aus einer Faltung (`domain/change-money.ts`).
  const cellsByArt = new Map(artIds.map((id) => [id, money.artByCycle(id)]));
  const pick = (id: string, field: "portfolio" | "frame") =>
    Object.fromEntries(
      Object.entries(cellsByArt.get(id) ?? {})
        .filter(([, c]) => c[field] !== 0)
        .map(([k, c]) => [k, c[field]]),
    );
  const budgetByArt = new Map(artIds.map((id) => [id, pick(id, "portfolio")]));
  const frameByArt = new Map(artIds.map((id) => [id, pick(id, "frame")]));
  const frameByPeriodTotal: Record<string, number> = {};
  for (const frame of frameByArt.values()) {
    for (const [k, v] of Object.entries(frame)) {
      frameByPeriodTotal[k] = (frameByPeriodTotal[k] ?? 0) + v;
    }
  }
  const portfolioKeys = [...budgetByArt.values()].flatMap((b) => Object.keys(b));

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

  // Columns: the budget-plan periods ∪ any half-year a feature's PI sits in ∪
  // die Halbjahre, in denen ein ART-Rahmen zugesprochen wurde — sonst fehlte
  // eine Spalte, in der nur ein Rahmen liegt.
  const periods = budgetPlusLoadPeriods(
    [
      ...new Set([
        ...vsBudgets.periods.map((p) => p.key),
        ...portfolioKeys,
        ...Object.keys(frameByPeriodTotal),
      ]),
    ],
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
  const betrieb = rtbItems.filter(
    (i) => i.valueStreamId === valueStreamId && i.active && !isChangeKind(i.kind),
  );
  /**
   * **Zugesprochen schlägt beantragt** (REQ-8) — dieselbe Regel wie in
   * `art-business-case.ts`, und die Frage gilt dem **ganzen Halbjahr**, nicht
   * der einzelnen Position: sobald der Wertstrom aufgeteilt hat, ist eine
   * Position ohne Zuspruch eine mit 0 €, keine, für die der geplante Betrag
   * einspringt.
   */
  const ownItems = new Set(betrieb.map((i) => i.id));
  const zuspruch = new Map(
    rtbAwards
      .filter((a) => a.cycleKey === cycleKey && ownItems.has(a.rtbItemId))
      .map((a) => [a.rtbItemId, a.amount] as const),
  );
  const operatingBasis: "awarded" | "planned" = zuspruch.size > 0 ? "awarded" : "planned";

  const operating = resolveRtbToArts(
    betrieb.map((i) => ({
      id: i.id,
      artId: i.artId,
      solutionId: i.solutionId,
      amount:
        operatingBasis === "awarded"
          ? (zuspruch.get(i.id) ?? 0)
          : rtbCycleAmount(i.plannedAmount, i.interval),
    })),
    Object.fromEntries(
      solutions.filter((s) => s.valueStreamId === valueStreamId).map((s) => [s.id, s.artId]),
    ),
    artIds,
  );

  const rows: ArtGridRow[] = arts.map((a) => {
    const portfolio = budgetByArt.get(a.id) ?? {};
    const frame = frameByArt.get(a.id) ?? {};
    return {
      artId: a.id,
      name: a.name,
      budgetByPeriod: Object.fromEntries(
        [...new Set([...Object.keys(portfolio), ...Object.keys(frame)])].map((k) => [
          k,
          (portfolio[k] ?? 0) + (frame[k] ?? 0),
        ]),
      ),
      frameByPeriod: frame,
      // `aggregateArtFeatureLoad(artIds, …)` guarantees exactly one entry per id
      // in `artIds` (= `arts.map(a => a.id)`), so this lookup is always present.
      load: loads.get(a.id)!,
      operatingPerCycle: operating.byArt[a.id] ?? 0,
    };
  });

  return buildArtGridModel({
    periods,
    // Die Bezugsgröße wächst mit den Zeilen. Stünde hier nur die Epic-Summe,
    // stiege die Auslastung über 100 % und „Nicht zugeordnet" würde negativ,
    // sobald ein Rahmen zugesprochen ist.
    vsByPeriod: Object.fromEntries(
      [...new Set([...Object.keys(epicByPeriod), ...Object.keys(frameByPeriodTotal)])].map((k) => [
        k,
        (epicByPeriod[k] ?? 0) + (frameByPeriodTotal[k] ?? 0),
      ]),
    ),
    rows,
    operatingBasis,
    operatingUnresolved: operating.unresolved.reduce((sum, u) => sum + u.amount, 0),
  });
}
