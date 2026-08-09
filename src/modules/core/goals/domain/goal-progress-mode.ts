/**
 * Fortschrittsquelle eines Ziel-Knotens (Asana-Modell „progress source").
 * Orthogonal zur **Geld**-Achse (€-Trio aus verknüpften Epics) — dieses Feld
 * steuert nur den normalisierten 0..1-**Fortschritt** eines Knotens.
 *
 *  - `manual`   — Ist-Wert von Hand gepflegt (`keyResultProgress` über die
 *                 `current`-Spalte); gilt auf jeder Ebene, auch als Override bei
 *                 einem Knoten **mit** Kindern.
 *  - `rollup`   — gewichteter Durchschnitt der Kind-Fortschritte (ADR-0008).
 *  - `auto_kpi` — Einzel-Blatt: Ist-Wert aus den verknüpften Epic-KPIs
 *                 (`autoKpiCurrent`, Δ×Faktor auf die Ziel-Skala); ignoriert Kinder.
 *  - `kpi_tree` — KPI-Baum-Knoten: **Blatt** rechnet wie `auto_kpi` (Ist aus KPIs),
 *                 **Ast** (mit Kindern) kaskadiert die Unterziel-Werte
 *                 (`nodeUnitValue`) und misst wert-basiert `realized/|target−baseline|`.
 *
 * `progressMode = null` in der DB ⇒ **abgeleitet** (`rollup` wenn Kinder, sonst
 * `manual`) = exakt das Verhalten vor Einführung des Feldes (kein Backfill).
 */

import { isMetricType } from "@/modules/core/goals/domain/goal-metric";
import { kpiDelta, direction, type KpiPoint } from "@/modules/core/kpi/domain/kpi-valuation";

export const PROGRESS_MODES = ["manual", "rollup", "auto_kpi", "kpi_tree"] as const;
export type ProgressMode = (typeof PROGRESS_MODES)[number];

export function isProgressMode(v: string | null | undefined): v is ProgressMode {
  return v != null && (PROGRESS_MODES as readonly string[]).includes(v);
}

// ── Blatt-vs-Ast-Rolle je Modus (eine Schnittstelle für alle Verzweigungen) ──
// Die Modi kodieren zwei orthogonale Fragen: „woher kommt der Ist-Wert?" und
// „aggregiere ich aus Kindern?". `kpi_tree` beantwortet beide **strukturell**
// (Blatt ⇒ aus KPIs, Ast ⇒ aus Kindern), daher diese Prädikate statt verstreuter
// `mode === …`-Vergleiche.

/** Ist-Wert wird aus verknüpften Epic-KPIs abgeleitet (auto_kpi, oder kpi_tree-Blatt). */
export function derivesCurrentFromKpis(mode: ProgressMode, hasChildren: boolean): boolean {
  return mode === "auto_kpi" || (mode === "kpi_tree" && !hasChildren);
}

/** Knoten aggregiert Fortschritt/Wert aus seinen Kindern (rollup, oder kpi_tree-Ast). */
export function aggregatesFromChildren(mode: ProgressMode, hasChildren: boolean): boolean {
  return hasChildren && (mode === "rollup" || mode === "kpi_tree");
}

/** Ast misst magnituden-/wert-basiert (`realized/|target−baseline|`) statt Kinder-Ø — nur kpi_tree. */
export function usesValueBasedCompletion(mode: ProgressMode, hasChildren: boolean): boolean {
  return mode === "kpi_tree" && hasChildren;
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
 * Ein Beitrag zum `auto_kpi`-Ist eines Ziels, je verknüpftem Epic (GoalEpicLink).
 * Die KPI-Bewegung ist stets ein **Delta** (Verbesserung Richtung KPI-Target,
 * `kpiDelta`), das in die Ziel-Einheit übersetzt und auf die Baseline
 * aufgerechnet wird (siehe `autoKpiCurrent`):
 *  - `factor`   — der Link hat eine gewählte KPI + Umrechnungsfaktor; der Beitrag
 *                 ist `kpiDelta(kpi) × factor` (Ziel-Einheiten-Δ je 1 KPI-Einheit-Δ).
 *  - `sameUnit` — kein Faktor: die einheiten-gleichen KPIs tragen ihr eigenes
 *                 `kpiDelta` bei (Faktor implizit 1).
 */
export type AutoKpiLink =
  | { kind: "factor"; kpi: KpiPoint; factor: number }
  | { kind: "sameUnit"; kpis: ReadonlyArray<{ unit: string | null; point: KpiPoint }> };

/** Ziel-Spezifikation für `autoKpiCurrent`: Einheit + eigene baseline/target-Skala. */
interface GoalAutoKpiSpec extends GoalUnitSpec {
  baseline: number | null;
  target: number | null;
}

/**
 * Abgeleiteter **absoluter** Ist-Wert für `auto_kpi`, in der Ziel-Einheit auf der
 * eigenen baseline→target-Skala: `baseline + Richtung × Σ (KPI-Δ × Faktor)`.
 * Die KPI-Bewegung ist ein Delta (`kpiDelta`), das über den Faktor (bevorzugt)
 * bzw. einheiten-gleich (Fallback) beiträgt; die Richtung stammt vom Ziel
 * (baseline→target), sodass ein Reduktionsziel korrekt sinkt.
 * `null`, wenn baseline/target fehlen oder nichts beiträgt (⇒ nicht messbar).
 */
export function autoKpiCurrent(
  goal: GoalAutoKpiSpec,
  links: ReadonlyArray<AutoKpiLink>,
): number | null {
  if (goal.baseline == null || goal.target == null) return null;
  const dir = direction(goal.baseline, goal.target);
  let sum = 0;
  let matched = false;
  for (const l of links) {
    if (l.kind === "factor") {
      if (l.kpi.baseline == null || l.kpi.target == null || l.kpi.current == null) continue;
      sum += kpiDelta(l.kpi) * l.factor;
      matched = true;
    } else {
      for (const k of l.kpis) {
        if (k.point.baseline == null || k.point.target == null || k.point.current == null) continue;
        if (!unitsMatch(goal, k.unit)) continue;
        sum += kpiDelta(k.point);
        matched = true;
      }
    }
  }
  return matched ? goal.baseline + dir * sum : null;
}

/**
 * Ob ein Knoten einen 0..1-Fortschritt liefern kann: `rollup` braucht Kinder;
 * `manual`/`auto_kpi` brauchen einen Zielwert; `kpi_tree` ist messbar als Ast
 * (über Kinder) **oder** als Blatt (über eigenen Zielwert).
 */
export function isMeasurableGoal(node: {
  progressMode: ProgressMode;
  target: number | null;
  hasChildren: boolean;
}): boolean {
  if (node.progressMode === "rollup") return node.hasChildren;
  if (node.progressMode === "kpi_tree") return node.hasChildren || node.target != null;
  return node.target != null;
}
