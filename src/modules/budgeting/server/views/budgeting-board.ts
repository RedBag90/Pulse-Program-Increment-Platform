/**
 * Board-Page-Model — die Naht zwischen „was die Datenbank hergibt" und „was das
 * Board zeigt". Nach dem Vorbild von `controlling-overview.ts`: impurer Loader,
 * **reiner** Builder.
 *
 * Der Builder ist bewusst auch der Rechner des Clients: das Board rechnet bei
 * jedem Tastendruck neu (Topf-Eingabe → „Verbleibend", Allokation → Wertstrom-
 * Chart). Vorher lag diese Ableitung als fünf `useMemo`s in der Komponente und
 * damit als ZWEITE Implementierung neben dem Server. Jetzt ruft die Komponente
 * dieselbe reine Funktion erneut auf — eine Regel, zwei Aufrufer.
 *
 * Rein, kein I/O, keine Uhr.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  requestedByPeriod,
  rollupByValueStream,
  poolRemaining,
  buildValueStreamSeries,
  type BudgetEpicView,
  type ChartRow,
  type HalfYearAxis,
  type ValueStreamRollup,
} from "@/modules/budgeting/domain/budgeting";
import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";
import type { Period } from "@/modules/budgeting/domain/period-window";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  getBudgetingBoard,
  type BudgetingBoardData,
} from "@/modules/budgeting/server/services/budgeting";

/** Eine Board-Zeile: das Epic plus sein je Periode abgeleiteter Bedarf. */
export interface BoardRow {
  epic: BudgetEpicView;
  /** Bedarf je Halbjahres-Key — abgeleitet, nie erfasst (REQ-B2). */
  requested: PeriodAmounts;
}

export interface BudgetingBoardModel {
  periods: Period[];
  axis: HalfYearAxis;
  /** Zeilen nach Priorität, aufsteigend — stabil bei Gleichstand. */
  rows: BoardRow[];
  /** Topf − Σ Allokationen je Periode; negativ = überalloziert (REQ-B4). */
  remaining: PeriodAmounts;
  rollup: ValueStreamRollup[];
  /** Chart-Zeilen je Periode, gestapelt nach Wertstrom. */
  chartRows: ChartRow[];
  /** Der Topf, wie er gespeichert ist — Ausgangswert der Eingabefelder. */
  pool: PeriodAmounts;
  /** Editierbare Halbjahre (Rolling-Window ab Anker); Rest read-only. */
  editableKeys: string[];
  /** Der aktive Zyklus (Anker) als Halbjahres-Key. */
  activeCycleKey: string;
  /** „H2 2026 – H1 2028" — die Spanne des editierbaren Fensters. */
  windowLabel: string;
  /** Fenstergröße in Halbjahren. */
  windowSize: number;
}

export interface BuildBudgetingBoardInputs {
  epics: readonly BudgetEpicView[];
  axis: HalfYearAxis;
  pool: PeriodAmounts;
  /** Editierbares Fenster; Default = alle Achsen-Perioden (Verhalten vor dem Rolling-Window). */
  editableKeys?: string[];
  /** Der Anker; Default = leer (keine gesonderte Tönung). */
  activeCycleKey?: string;
  /** Fenstergröße; Default = Anzahl editierbarer Perioden. */
  windowSize?: number;
}

/**
 * Faltet Epics, Achse und Topf in das render-fertige Board-Modell. Der Client
 * ruft dieselbe Funktion mit seinem Live-Editier-Stand auf, damit „Verbleibend"
 * und Chart beim Tippen nach exakt derselben Regel rechnen wie der Server.
 */
export function buildBudgetingBoardModel(inputs: BuildBudgetingBoardInputs): BudgetingBoardModel {
  const { axis, pool } = inputs;
  const editableKeys = inputs.editableKeys ?? axis.periods.map((p) => p.key);
  const activeCycleKey = inputs.activeCycleKey ?? "";
  const windowSize = inputs.windowSize ?? editableKeys.length;
  const epics = [...inputs.epics].sort((a, b) => a.priority - b.priority);

  const rollup = rollupByValueStream(epics, axis);
  const sortedWindow = [...editableKeys].sort();
  const first = sortedWindow[0];
  const last = sortedWindow[sortedWindow.length - 1];
  const windowLabel =
    first && last
      ? first === last
        ? halfYearLabel(first)
        : `${halfYearLabel(first)} – ${halfYearLabel(last)}`
      : "";

  return {
    periods: axis.periods,
    axis,
    rows: epics.map((epic) => ({ epic, requested: requestedByPeriod(epic, axis) })),
    remaining: poolRemaining(pool, epics, axis),
    rollup,
    chartRows: buildValueStreamSeries(rollup, axis.periods),
    pool,
    editableKeys,
    activeCycleKey,
    windowLabel,
    windowSize,
  };
}

/** Lädt die Board-Eingaben (eine Query-Welle im Service) und faltet sie. */
export async function loadBudgetingBoardModel(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingBoardModel> {
  const data: BudgetingBoardData = await getBudgetingBoard(db, tenantId);
  return buildBudgetingBoardModel({
    epics: data.epics,
    axis: { start: data.axis.start, count: data.axis.count, periods: data.periods },
    pool: data.pool,
    editableKeys: data.editableKeys,
    activeCycleKey: data.activeCycleKey,
    windowSize: data.windowSize,
  });
}
