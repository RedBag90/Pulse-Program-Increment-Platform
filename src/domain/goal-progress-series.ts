/**
 * Fortschritts-/Wert-Verläufe für den Ziel-Graf. Die Linie eines Knotens folgt
 * seiner Fortschrittsquelle (goal-progress-mode.ts):
 *   - auto_kpi → zeitlicher KPI-Verlauf (einheitengleiche Summe),
 *   - rollup   → gewichteter Ø der Unterziele über die Zeit (rekursiv),
 *   - manual   → eigene Status-Snapshots + Live-Ende.
 *
 * Reine Funktionen, kein I/O — der Loader füllt den `SeriesNode`-Baum, das UI
 * rendert das Ergebnis. Fortschritt ist stets 0..1 (einheiten-unabhängig, für
 * die Aggregation), Wert-Serien tragen die Roh-Einheit.
 */

import { keyResultProgress } from "@/domain/goals-rollup";
import { unitsMatch, type ProgressMode } from "@/domain/goal-progress-mode";
import type { Measurement } from "@/domain/kpi-measurement";

export interface SeriesPoint {
  at: string;
  value: number;
}
export interface ProgressPoint {
  at: string;
  progress: number;
}

interface UnitSpec {
  metricUnit: string | null;
  metricType: string | null;
  currencyCode: string | null;
}

interface SeriesKpi {
  unit: string | null;
  measurements: Measurement[];
}

export interface SeriesNode {
  progressMode: ProgressMode;
  baseline: number | null;
  target: number | null;
  current: number | null;
  /** Gewicht im Eltern-Rollup (Default 1). */
  rollupWeight: number;
  unitSpec: UnitSpec;
  /** Eigene Status-Check-ins (eingefrorener Fortschritt 0..1), beliebige Reihenfolge. */
  checkins: ProgressPoint[];
  /** Verknüpfte Epic-KPIs (nur bei auto_kpi relevant). */
  kpis: SeriesKpi[];
  children: SeriesNode[];
}

const byAt = (a: { at: string }, b: { at: string }): number =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

/**
 * Wert-Verlauf für auto_kpi: Union der Messtermine der einheitengleichen KPIs;
 * je Termin die laufende Summe der zuletzt bekannten Werte pro KPI (Step).
 */
export function buildAutoKpiSeries(unitSpec: UnitSpec, kpis: SeriesKpi[]): SeriesPoint[] {
  const matched = kpis.filter((k) => unitsMatch(unitSpec, k.unit));
  const events: { i: number; at: string; value: number }[] = [];
  matched.forEach((k, i) => {
    for (const m of k.measurements) events.push({ i, at: m.at, value: m.value });
  });
  events.sort(byAt);

  const latest = new Map<number, number>();
  const out: SeriesPoint[] = [];
  for (const e of events) {
    latest.set(e.i, e.value);
    let sum = 0;
    for (const v of latest.values()) sum += v;
    const last = out[out.length - 1];
    if (last && last.at === e.at)
      last.value = sum; // ein Punkt je Termin
    else out.push({ at: e.at, value: sum });
  }
  return out;
}

/** Step-Lookup: der jüngste Fortschritt mit `at' <= at`, sonst `null`. */
function progressAt(series: ProgressPoint[], at: string): number | null {
  let val: number | null = null;
  for (const p of series) {
    if (p.at <= at) val = p.progress;
    else break; // aufsteigend sortiert
  }
  return val;
}

/**
 * Fortschritts-Verlauf (0..1) eines Knotens, rekursiv nach Fortschrittsquelle.
 * `now` (ISO) markiert das Live-Ende für manual/auto_kpi.
 */
export function buildNodeProgressSeries(node: SeriesNode, now: string): ProgressPoint[] {
  if (node.progressMode === "rollup") {
    const childSeries = node.children.map((c) => ({
      w: c.rollupWeight > 0 ? c.rollupWeight : 1,
      s: buildNodeProgressSeries(c, now),
    }));
    const dates = [...new Set(childSeries.flatMap((cs) => cs.s.map((p) => p.at)))].sort();
    const out: ProgressPoint[] = [];
    for (const at of dates) {
      let wsum = 0;
      let acc = 0;
      for (const cs of childSeries) {
        const p = progressAt(cs.s, at);
        if (p == null) continue; // Kind ohne Wert (noch) → ausklammern
        wsum += cs.w;
        acc += cs.w * p;
      }
      if (wsum > 0) out.push({ at, progress: acc / wsum });
    }
    return out;
  }

  if (node.progressMode === "auto_kpi") {
    return buildAutoKpiSeries(node.unitSpec, node.kpis).map((p) => ({
      at: p.at,
      progress: keyResultProgress({
        baseline: node.baseline,
        target: node.target,
        current: p.value,
      }),
    }));
  }

  // manual: eigene Status-Snapshots + Live-Ende aus dem aktuellen Ist-Wert.
  const pts = [...node.checkins].sort(byAt).map((c) => ({ at: c.at, progress: c.progress }));
  if (node.current != null && node.target != null) {
    pts.push({
      at: now,
      progress: keyResultProgress({
        baseline: node.baseline,
        target: node.target,
        current: node.current,
      }),
    });
  }
  return pts;
}
