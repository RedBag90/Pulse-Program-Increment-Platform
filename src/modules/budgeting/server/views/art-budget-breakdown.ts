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
export interface ArtGridRow {
  artId: string;
  name: string;
  /** Veränderungsgeld je Halbjahr — Portfolio-Zuteilung **plus** ART-Rahmen. */
  budgetByPeriod: PeriodAmounts;
  /** Der Rahmenanteil daraus, für die Aufschlüsselung an der Zelle. */
  frameByPeriod: PeriodAmounts;
  load: ArtFeatureLoad;
  /**
   * Betriebsgeld dieses ARTs je Halbjahr (REQ-9). **Steht neben der Rechnung,
   * nicht darin:** `allocatedByPeriod` und alles, was daraus folgt, bleiben
   * Veränderungsgeld (REQ-10).
   */
  operatingPerCycle: number;
}

export interface ArtGridModel {
  /** Budget-Perioden ∪ Halbjahre der Feature-PIs (REQ-A4). */
  periods: Period[];
  /**
   * Das Veränderungsgeld des Wertstroms, gegen das die ARTs ziehen — Σ der
   * Epic-Zuteilungen **plus** Σ der ART-Rahmen. Auf der Fläche heißt die Zeile
   * „Wertstrom · Veränderung"; „Wertstrom-Budget" ist anderswo die reine
   * Epic-Summe und bleibt es (§2.5).
   */
  vsByPeriod: PeriodAmounts;
  rows: ArtGridRow[];
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
  /** Woher die Betriebsbeträge stammen — die Spalte beschriftet sich danach. */
  operatingBasis: "awarded" | "planned";
  /** Betriebsgeld, das keinem ART zuzuordnen war — die Fläche benennt es. */
  operatingUnresolved: number;
}

export interface BuildArtGridInputs {
  periods: readonly Period[];
  vsByPeriod: PeriodAmounts;
  rows: readonly ArtGridRow[];
  operatingBasis?: "awarded" | "planned";
  operatingUnresolved?: number;
}

/**
 * Faltet Spalten, Wertstrom-Budget und ART-Zeilen in das render-fertige Modell.
 * `rows[*].budgetByPeriod` ist der Stand, gegen den gerechnet wird — beim Server
 * der gespeicherte, beim Client der gerade eingetippte.
 */
export function buildArtGridModel(inputs: BuildArtGridInputs): ArtGridModel {
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
    operatingBasis: inputs.operatingBasis ?? "planned",
    operatingUnresolved: inputs.operatingUnresolved ?? 0,
  };
}

/** Lädt den Breakdown eines Wertstroms und faltet ihn. */
export async function loadArtGridModel(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
  /** Das gewählte Halbjahr — nur die Betriebsspalte braucht es (REQ-8). */
  cycleKey?: string,
): Promise<ArtGridModel> {
  const breakdown = await getArtBudgetBreakdown(db, tenantId, valueStreamId, cycleKey);
  return buildArtGridModel({
    periods: breakdown.periods,
    vsByPeriod: breakdown.vsByPeriod,
    rows: breakdown.arts,
    operatingBasis: breakdown.operatingBasis,
    operatingUnresolved: breakdown.operatingUnresolved,
  });
}
