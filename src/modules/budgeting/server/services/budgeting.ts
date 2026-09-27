/**
 * Lese-Seite der Budgetvergabe: das Board (vorgemerkte Epics mit freigegebener
 * Hypothese oder freigegebenem Business Case), der Topf je Halbjahr und die
 * daraus abgeleiteten Wertstrom-Budgets. Die Halbjahres-Rechnung liegt im reinen
 * `domain/budgeting`.
 *
 * **Nur noch lesend, bis auf den PB-Default-Aufwand.** Topf und Zuteilung wurden
 * früher hier von Hand geschrieben; der Topf lebt jetzt je Kachel in
 * `BudgetRound.poolTotal`, die Zuteilung entsteht aus deren Finalisierung
 * (`finalize-service`).
 */

import { cache } from "react";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { deriveEpicEconomics } from "@/modules/work/domain/epic-economics";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import { sortCycles, cycleLabel } from "@/modules/budgeting/domain/cycle";
import {
  parsePeriodAmountMap,
  type BudgetEpicView,
  type HalfYearAxis,
} from "@/modules/budgeting/domain/budgeting";
import { rollingWindow } from "@/modules/budgeting/domain/period-window";
import { resolveWindowSize } from "@/modules/budgeting/domain/budget-cycle";
import { loadBudgetStichtag } from "@/modules/budgeting/server/services/budget-stichtag";
import { loadChangeMoney } from "@/modules/budgeting/server/services/change-money";

export interface BudgetingBoardData {
  epics: BudgetEpicView[];
  periods: { key: string; label: string }[];
  /** Total budget pool per half-year key. */
  pool: Record<string, number>;
  /**
   * The forecast axis identity, so the client need not re-parse `periods[0]`
   * to recover the horizon start. `periods.length === count`.
   */
  axis: { start: Date; count: number };
}

/** A Value Stream's budget derived from its Epics' allocations, per half-year. */
export interface ValueStreamBudget {
  valueStreamId: string;
  name: string;
  /** Σ allocated to this Value Stream's Epics per half-year key. */
  byPeriod: Record<string, number>;
  /** Σ across all periods. */
  total: number;
}

export interface ValueStreamBudgetData {
  /** The participatory-budgeting forecast horizon (half-years), oldest first. */
  periods: { key: string; label: string }[];
  valueStreams: ValueStreamBudget[];
}

/** Reads a JSON map of period-key → number, discarding malformed entries. */
/**
 * The shared participatory-budgeting model: the eligible Epics, the forecast
 * half-year axis, and the tenant pool. Backs both the budgeting board and the
 * derived Value-Stream budgets, so both use the identical horizon + population.
 */
const loadBudgetingModel = cache(async function loadBudgetingModel(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<{
  epics: BudgetEpicView[];
  axis: HalfYearAxis;
  pool: Record<string, number>;
}> {
  const [rows, tenant, rounds, stichtag] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        // **Nur mit freigegebenem Lean Business Case** — dieselbe Grenze wie in
        // `pb-list.ts`, `art-pot-view.ts` und `art-budget-access.ts`, und
        // dieselbe, die `isPbEligible` als reines Praedikat zieht.
        //
        // Hier stand bis zuletzt `hypothesisApprovedAt ODER businessCaseApprovedAt`
        // — die Menge von **vor September 2026**, als das Portfolio noch die
        // Erarbeitung des Business Case budgetierte. Der Weg ist entfallen
        // (`pb-submission.ts:10-20`), diese eine Zeile ist bei der Umstellung
        // stehengeblieben. Der Test, der sie haette fangen sollen, haelt die
        // Regel seitdem fest, laeuft aber nur mit `DATABASE_URL_TEST`.
        businessCaseApprovedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        businessCase: true,
        timeline: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        createdAt: true,
        valueStream: { select: { id: true, name: true } },
        budgetAllocation: {
          select: { priority: true, allocations: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { budgetWindowSize: true },
    }),
    // Der Topf lebt in den Kacheln. Der frühere `Tenant.budgetPoolByPeriod` war
    // seit dem Wegfall des €-Boards nicht mehr pflegbar und lief gegen die
    // Zuteilungen auseinander, die die Finalisierung schreibt.
    db.budgetRound.findMany({
      where: { tenantId },
      select: { cycleKey: true, poolTotal: true },
    }),
    loadBudgetStichtag(db, tenantId),
  ]);

  const epics: BudgetEpicView[] = rows.map((row) => {
    const view = deriveEpicEconomics({
      businessCase: row.businessCase,
      timeline: row.timeline,
      businessCaseApprovedAt: row.businessCaseApprovedAt,
      hypothesisApprovedAt: row.hypothesisApprovedAt,
      createdAt: row.createdAt,
      kpis: [], // budgeting does not use KPI-driven benefit
    });
    const alloc = row.budgetAllocation;
    return {
      id: row.id,
      title: row.title,
      valueStreamId: row.valueStream?.id ?? null,
      valueStream: row.valueStream?.name ?? null,
      costSlices: view.costSlices,
      startKey: halfYearKey(view.costStart),
      allocations: parsePeriodAmountMap(alloc?.allocations),
      priority: alloc?.priority ?? 0,
    };
  });

  // Mehrere Kacheln können dasselbe Halbjahr tragen — ihre Töpfe addieren sich.
  const pool: Record<string, number> = {};
  for (const r of rounds) {
    pool[r.cycleKey] = (pool[r.cycleKey] ?? 0) + Number(r.poolTotal);
  }

  // Rolling-Window: der Board-Horizont sind die `windowSize` Halbjahre ab dem
  // Anker (editierbar), plus alle Perioden mit Daten (Topf/Allokation) als
  // read-only Kontext. Der Anker ist das Halbjahr der geltenden Kachel, ohne
  // sie das Kalender-Halbjahr — dieselbe Antwort wie überall (Budget-Stichtag).
  // Bis September 2026 war es die Kachel mit Status „running", also die, an der
  // gearbeitet wird; die Liste stand damit neben dem Topf auf einem anderen Halbjahr.
  const activeCycle = stichtag.focusKey;
  const windowSize = resolveWindowSize({ budgetWindowSize: tenant?.budgetWindowSize ?? null });
  const dataKeys = [
    ...new Set([...Object.keys(pool), ...epics.flatMap((e) => Object.keys(e.allocations))]),
  ];
  const win = rollingWindow(activeCycle, windowSize, dataKeys);

  return { epics, axis: win.axis, pool };
});

/** Ein Epic, das für die Runde in Frage kommt, aber noch nicht vorgemerkt ist. */
export interface BudgetingCandidate {
  id: string;
  title: string;
  valueStream: string | null;
}

/** Loads the budgeting board: eligible Epics + their need/allocation + the pool. */
export async function getBudgetingBoard(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingBoardData> {
  const { epics, axis, pool } = await loadBudgetingModel(db, tenantId);
  return {
    epics,
    periods: axis.periods,
    pool,
    axis: { start: axis.start, count: axis.count },
  };
}

/**
 * Wertstrom-Budgets, abgeleitet aus den **final zugeteilten** Beträgen der
 * Epic-Kandidaten, je Halbjahr der Kachel, die sie zugeteilt hat.
 *
 * Quelle ist `BudgetCandidate.finalAmount` — dieselbe wie beim ART-Budget, damit
 * beide Zahlen nicht auseinanderlaufen können. Vorher rollte diese Stelle die
 * `BudgetAllocation`-Zeilen der **noch vorgemerkten** Epics auf: ein Epic, das
 * nach der Finalisierung aus der Vormerkung fiel, verschwand hier, blieb aber im
 * ART-Budget stehen. Der Bucket „Ohne Wertstrom" fällt raus.
 */
/**
 * Die abgeleiteten Wertstrom-Budgets.
 *
 * **Die Achse kommt aus den Zuteilungen selbst.** Vorher hing sie an
 * `loadBudgetingModel` — dem Prognose-Horizont, der dafür jedes vorgemerkte
 * Epic des Mandanten mit `businessCase`, `timeline` und `allocations` lädt, um
 * daraus Kostenfenster abzuleiten. Von diesem Modell behielt die Funktion
 * **nur die Achse**; die Epic-Zeilen samt dreier JSON-Spalten wurden geladen
 * und weggeworfen.
 *
 * Das war auch fachlich schief: die Sicht heißt „was wurde zugeteilt", und eine
 * Prognose-Achse setzt Spalten davor und dahinter, in denen nichts steht. Die
 * belegten Halbjahre sind die richtige Achse für diese Frage.
 *
 * `cache` sitzt hier und nicht eine Ebene tiefer, weil zwei Aufrufer je Anfrage
 * dasselbe fragen (die Wertstrom-Seite und der ART-Breakdown darunter) — vorher
 * fing der Cache nur die halbe Arbeit ab, und `loadFinalizedByValueStream` lief
 * zweimal.
 */
export const getValueStreamBudgets = cache(async function getValueStreamBudgets(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<ValueStreamBudgetData> {
  const byVs = await loadFinalizedByValueStream(db, tenantId);
  const valueStreams: ValueStreamBudget[] = [...byVs.values()].map((v) => ({
    valueStreamId: v.valueStreamId,
    name: v.name,
    byPeriod: v.byPeriod,
    total: Object.values(v.byPeriod).reduce((a, b) => a + b, 0),
  }));

  // Die Spalten sind die Vereinigung der belegten Halbjahre über alle
  // Wertströme — damit die Tabellen zweier Wertströme nebeneinander dieselbe
  // Achse haben.
  const occupied = new Set<string>();
  for (const v of valueStreams) for (const k of Object.keys(v.byPeriod)) occupied.add(k);

  return { periods: periodsFromOccupied(occupied), valueStreams };
});

/** Belegte Halbjahre als Spalten — sortiert, dedupliziert, beschriftet. */
function periodsFromOccupied(keys: Iterable<string>): { key: string; label: string }[] {
  return sortCycles(keys).map((key) => ({ key, label: cycleLabel(key) }));
}

interface FinalizedValueStream {
  valueStreamId: string;
  name: string;
  byPeriod: Record<string, number>;
}

/**
 * Die finalen Epic-Zuteilungen je Wertstrom und Halbjahr — aus der Faltung des
 * Veränderungsgeldes (`domain/change-money.ts`). Hier stand bis September 2026
 * eine eigene Kandidaten-Abfrage mit eigener Summe; der Funding-Snapshot und
 * die Verteil-Matrix rechneten dieselbe Zahl noch einmal.
 */
async function loadFinalizedByValueStream(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Map<string, FinalizedValueStream>> {
  const [money, streams] = await Promise.all([
    loadChangeMoney(db, tenantId),
    db.valueStream.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(streams.map((v) => [v.id, v.name]));
  return new Map(
    money.valueStreamIds().map((id) => [
      id,
      {
        valueStreamId: id,
        name: nameOf.get(id) ?? "",
        byPeriod: money.valueStreamPortfolioByCycle(id),
      },
    ]),
  );
}

// Die Tenant-Einstellung „Standard-Aufwand für Hypothesen-Epics" ist entfallen.
// Sie konfigurierte den Kosten-Richtwert für Epics, die erst eine Benefit-
// Hypothese hatten — und damit die Finanzierung der Business-Case-Erarbeitung
// durch das Portfolio. Mit dem Weg ist auch ihr Setzer weggefallen.
