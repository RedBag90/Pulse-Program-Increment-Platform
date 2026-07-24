/**
 * Fortschrittsquelle eines Ziel-Knotens (Asana-Modell „progress source").
 * Orthogonal zur **Geld**-Achse (`formula`/€-Trio) — dieses Feld steuert nur den
 * normalisierten 0..1-**Fortschritt** eines Knotens.
 *
 *  - `manual`   — Ist-Wert von Hand gepflegt (`keyResultProgress` über die
 *                 `current`-Spalte); gilt auf jeder Ebene, auch als Override bei
 *                 einem Knoten **mit** Kindern.
 *  - `rollup`   — gewichteter Durchschnitt der Kind-Fortschritte.
 *  - `auto_kpi` — Ist-Wert = Summe der Ist-Werte der einheitengleichen KPIs aus
 *                 verknüpften Epics; dann `keyResultProgress` gegen baseline/target.
 *
 * `progressMode = null` in der DB ⇒ **abgeleitet** (`rollup` wenn Kinder, sonst
 * `manual`) = exakt das Verhalten vor Einführung des Feldes (kein Backfill).
 */

import { isMetricType } from "@/domain/goal-metric";

export const PROGRESS_MODES = ["manual", "rollup", "auto_kpi"] as const;
export type ProgressMode = (typeof PROGRESS_MODES)[number];

export function isProgressMode(v: string | null | undefined): v is ProgressMode {
  return v != null && (PROGRESS_MODES as readonly string[]).includes(v);
}

/**
 * Effektiver Modus: ein gültig gespeicherter Wert gewinnt; sonst wird aus der
 * Struktur abgeleitet (Kinder ⇒ `rollup`, sonst `manual`).
 */
export function effectiveProgressMode(
  stored: string | null | undefined,
  hasChildren: boolean,
): ProgressMode {
  if (isProgressMode(stored)) return stored;
  return hasChildren ? "rollup" : "manual";
}

interface GoalUnitSpec {
  metricUnit: string | null;
  metricType: string | null;
  currencyCode: string | null;
}

function normUnit(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Einheiten-Gleichheit zwischen einem Ziel und einer KPI. Bei Währung zählt der
 * Währungscode; sonst das freie Einheit-Label (trim/case-insensitiv). Leere
 * Einheiten gelten nie als gleich (sonst würden alle unbenannten Größen summiert).
 */
export function unitsMatch(goal: GoalUnitSpec, kpiUnit: string | null | undefined): boolean {
  const type = isMetricType(goal.metricType) ? goal.metricType : "number";
  if (type === "currency") {
    const g = normUnit(goal.currencyCode);
    return g !== "" && g === normUnit(kpiUnit);
  }
  const g = normUnit(goal.metricUnit);
  return g !== "" && g === normUnit(kpiUnit);
}

/**
 * Abgeleiteter Ist-Wert für `auto_kpi`: Summe der `current`-Werte aller
 * einheitengleichen KPIs. `null`, wenn keine KPI passt (⇒ Knoten nicht messbar).
 */
export function autoKpiCurrent(
  goal: GoalUnitSpec,
  kpis: ReadonlyArray<{ unit: string | null; current: number | null }>,
): number | null {
  let sum = 0;
  let matched = false;
  for (const k of kpis) {
    if (k.current == null) continue;
    if (!unitsMatch(goal, k.unit)) continue;
    sum += k.current;
    matched = true;
  }
  return matched ? sum : null;
}

/**
 * Ob ein Knoten einen 0..1-Fortschritt liefern kann: `rollup` braucht Kinder;
 * `manual`/`auto_kpi` brauchen einen Zielwert.
 */
export function isMeasurableGoal(node: {
  progressMode: ProgressMode;
  target: number | null;
  hasChildren: boolean;
}): boolean {
  if (node.progressMode === "rollup") return node.hasChildren;
  return node.target != null;
}
