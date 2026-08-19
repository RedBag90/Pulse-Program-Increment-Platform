/**
 * Revisions-Page-Model — die Kennzahlen und Spalten der Revisions-Detailsicht.
 *
 * Der Snapshot ist eingefroren, also gibt es hier keinen Editier-Stand und
 * keinen Loader-Bedarf jenseits des Services: dieses Modell ist eine **reine**
 * Faltung. Vorher rechnete die 426-Zeilen-Server-Komponente ihre vier Headline-
 * Zahlen und die sichtbaren Spalten selbst aus dem Snapshot.
 *
 * Rein, kein I/O, keine Uhr.
 */

import {
  summarizeSnapshot,
  type BudgetPlanSnapshot,
} from "@/modules/budgeting/domain/budget-plan-snapshot";
import { sumPeriods } from "@/modules/budgeting/domain/period-map";
import {
  computeDisplayPeriods,
  type SnapshotDisplayPeriod,
} from "@/modules/budgeting/domain/period-window";

export interface BudgetPlanRevisionModel {
  snapshot: BudgetPlanSnapshot;
  /** Sichtbare Spalten: Vorgänger + Zyklus + spätere mit Daten (REQ-R5). */
  displayPeriods: SnapshotDisplayPeriod[];
  /** Σ Allokation im erfassten Zyklus (REQ-R4). */
  cycleBudgetSum: number;
  /** Σ Rest in späteren Halbjahren (REQ-R4). */
  followBudgetSum: number;
  /** Σ Tenant-Topf über alle eingefrorenen Perioden. */
  poolSum: number;
  /** Anzahl Features, die im erfassten Zyklus einem PI zugewiesen waren. */
  cycleFeatureCount: number;
  /** Belegte Halbjahre nach dem Zyklus — Untertitel der Folgebudget-Kachel. */
  followPeriodCount: number;
}

/**
 * Faltet einen eingefrorenen Snapshot in das render-fertige Modell. Die Zyklus-
 * und Folgesummen kommen aus `summarizeSnapshot` — derselben Quelle, die
 * Übersichtsliste und Detailsicht benutzen, damit beide identische Zahlen zeigen.
 */
export function buildBudgetPlanRevisionModel(
  snapshot: BudgetPlanSnapshot,
): BudgetPlanRevisionModel {
  const { cycleBudgetSum, followBudgetSum } = summarizeSnapshot(snapshot);
  return {
    snapshot,
    displayPeriods: computeDisplayPeriods(snapshot),
    cycleBudgetSum,
    followBudgetSum,
    poolSum: sumPeriods(snapshot.budgetPoolByPeriod),
    cycleFeatureCount: snapshot.epics.reduce((sum, e) => sum + e.cycleFeatures.length, 0),
    followPeriodCount: Math.max(snapshot.periods.length - 1, 0),
  };
}
