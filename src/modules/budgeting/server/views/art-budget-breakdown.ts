/**
 * ART-Breakdown-Page-Model — Spalten, Verbleibend und Last-Zeilen des
 * Wertstrom-Details. Wie beim Board (`budgeting-board.ts`) ist der Builder rein
 * und wird von BEIDEN Seiten aufgerufen: der Server faltet den gespeicherten
 * Stand, der Client faltet beim Tippen seinen Editier-Stand — eine Regel für
 * „Verbleibend", nicht zwei.
 *
 * Rein, kein I/O.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { artBudgetRemaining, type ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";
import type { Period } from "@/modules/budgeting/domain/period-window";
import { getArtBudgetBreakdown } from "@/modules/budgeting/server/services/art-budget";

/** Eine ART-Zeile: Name, verteiltes Budget je Halbjahr, Feature-Last. */
export interface ArtBudgetModelRow {
  artId: string;
  name: string;
  budgetByPeriod: PeriodAmounts;
  load: ArtFeatureLoad;
}

export interface ArtBudgetModel {
  /** Budget-Perioden ∪ Halbjahre der Feature-PIs (REQ-A4). */
  periods: Period[];
  /** Das abgeleitete Wertstrom-Budget, gegen das die ARTs ziehen. */
  vsByPeriod: PeriodAmounts;
  rows: ArtBudgetModelRow[];
  /** VS-Budget − Σ ART-Budgets je Periode; negativ = überverteilt (REQ-A2). */
  remaining: PeriodAmounts;
  /** Kein ART im Wertstrom — die Sicht zeigt dann nur einen Hinweis. */
  isEmpty: boolean;
}

export interface BuildArtBudgetInputs {
  periods: readonly Period[];
  vsByPeriod: PeriodAmounts;
  rows: readonly ArtBudgetModelRow[];
}

/**
 * Faltet Spalten, Wertstrom-Budget und ART-Zeilen in das render-fertige Modell.
 * `rows[*].budgetByPeriod` ist der Stand, gegen den gerechnet wird — beim Server
 * der gespeicherte, beim Client der gerade eingetippte.
 */
export function buildArtBudgetModel(inputs: BuildArtBudgetInputs): ArtBudgetModel {
  const periods = [...inputs.periods];
  const rows = [...inputs.rows];
  return {
    periods,
    vsByPeriod: inputs.vsByPeriod,
    rows,
    remaining: artBudgetRemaining(
      inputs.vsByPeriod,
      rows.map((r) => r.budgetByPeriod),
      periods.map((p) => p.key),
    ),
    isEmpty: rows.length === 0,
  };
}

/** Lädt den Breakdown eines Wertstroms und faltet ihn. */
export async function loadArtBudgetModel(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
): Promise<ArtBudgetModel> {
  const breakdown = await getArtBudgetBreakdown(db, tenantId, valueStreamId);
  return buildArtBudgetModel({
    periods: breakdown.periods,
    vsByPeriod: breakdown.vsByPeriod,
    rows: breakdown.arts,
  });
}
