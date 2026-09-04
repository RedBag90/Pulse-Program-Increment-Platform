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
import { unassignedToArts, type ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
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
  /** Σ der ART-Zeilen je Halbjahr — die Auslastung. */
  allocatedByPeriod: PeriodAmounts;
  /**
   * Wertstrom-Budget − Σ ART-Zeilen. **Kein Rest im Sinne einer Reserve:** die
   * Differenz sind Zuteilungen, die keiner ART-Zeile dieses Wertstroms
   * zugeordnet sind — Epics ohne ART oder mit einem fremden. Deshalb heißt die
   * Funktion dahinter `unassignedToArts` und nicht mehr `artBudgetRemaining`.
   */
  unassigned: PeriodAmounts;
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
    // Σ der ART-Zeilen je Halbjahr — die Zahl, die die Auslastungs-Leiste
    // braucht. Vorher lieferte das Modell nur `unassignedToArts` (früher
    // `artBudgetRemaining`), und die Fläche rechnete `Budget − Rest` zurück,
    // um an sie heranzukommen.
    allocatedByPeriod: Object.fromEntries(
      periods.map((p) => [p.key, rows.reduce((sum, r) => sum + (r.budgetByPeriod[p.key] ?? 0), 0)]),
    ),
    unassigned: unassignedToArts(
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
