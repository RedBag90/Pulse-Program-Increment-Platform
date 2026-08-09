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

import { keyResultProgress } from "@/modules/core/goals/domain/goals-rollup";
import {
  unitsMatch,
  aggregatesFromChildren,
  derivesCurrentFromKpis,
  type ProgressMode,
} from "@/modules/core/goals/domain/goal-progress-mode";
import { direction } from "@/domain/kpi-valuation";
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

/**
 * Ein zeitlicher Beitrag zum `auto_kpi`-Verlauf, je verknüpftem Epic — analog zu
 * `AutoKpiLink` (goal-progress-mode.ts), aber mit der vollen **Messreihe** je KPI.
 * Jede Messung liefert ein **Delta** (Verbesserung ggü. KPI-Baseline Richtung
 * KPI-Target), das über den Faktor (bzw. 1 bei sameUnit) in die Ziel-Einheit
 * übersetzt wird:
 *  - `factor`   — gewählte KPI + Faktor; Delta = `(value − kpiBaseline) × dir × factor`.
 *  - `sameUnit` — einheiten-gleiche KPIs; Delta = `(value − kpiBaseline) × dir`.
 */
export type AutoKpiSeriesLink =
  | {
      kind: "factor";
      kpiBaseline: number | null;
      kpiTarget: number | null;
      measurements: Measurement[];
      factor: number;
    }
  | {
      kind: "sameUnit";
      kpis: {
        unit: string | null;
        baseline: number | null;
        target: number | null;
        measurements: Measurement[];
      }[];
    };

export interface SeriesNode {
  progressMode: ProgressMode;
  baseline: number | null;
  target: number | null;
  current: number | null;
  /** Gewicht im Eltern-Rollup (Default 1). */
  rollupWeight: number;
  /** Asana „Remove from automatic progress": false ⇒ zählt nicht im Eltern-Rollup. */
  includeInParentRollup: boolean;
  unitSpec: UnitSpec;
  /** Eigene Status-Check-ins (eingefrorener Fortschritt 0..1), beliebige Reihenfolge. */
  checkins: ProgressPoint[];
  /** Verknüpfte Epic-KPIs (nur bei auto_kpi relevant), faktor-bewusst. */
  autoKpiLinks: AutoKpiSeriesLink[];
  children: SeriesNode[];
}

/** Ziel-Spezifikation für `buildAutoKpiSeries`: Einheit + baseline/target-Skala. */
interface AutoKpiSeriesGoal extends UnitSpec {
  baseline: number | null;
  target: number | null;
}

const byAt = (a: { at: string }, b: { at: string }): number =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

/**
 * **Absoluter** Wert-Verlauf für auto_kpi in der Ziel-Einheit, konsistent mit
 * `autoKpiCurrent`: je Termin `baseline + Richtung(Ziel) × Σ (KPI-Δ × Faktor)`.
 * Jeder beitragende KPI-Strom trägt sein zuletzt bekanntes Delta bei (Step).
 */
export function buildAutoKpiSeries(
  goal: AutoKpiSeriesGoal,
  links: AutoKpiSeriesLink[],
): SeriesPoint[] {
  if (goal.baseline == null || goal.target == null) return [];
  const goalDir = direction(goal.baseline, goal.target);
  const goalBaseline = goal.baseline;

  // Beitragende Ströme: je Strom KPI-Baseline/Richtung/Faktor + Messreihe.
  const streams: { baseline: number; dir: number; factor: number; ms: Measurement[] }[] = [];
  for (const l of links) {
    if (l.kind === "factor") {
      if (l.kpiBaseline == null || l.kpiTarget == null) continue;
      streams.push({
        baseline: l.kpiBaseline,
        dir: direction(l.kpiBaseline, l.kpiTarget),
        factor: l.factor,
        ms: l.measurements,
      });
    } else {
      for (const k of l.kpis) {
        if (!unitsMatch(goal, k.unit)) continue;
        if (k.baseline == null || k.target == null) continue;
        streams.push({
          baseline: k.baseline,
          dir: direction(k.baseline, k.target),
          factor: 1,
          ms: k.measurements,
        });
      }
    }
  }

  const events: { i: number; at: string; value: number }[] = [];
  streams.forEach((s, i) => {
    for (const m of s.ms) events.push({ i, at: m.at, value: m.value });
  });
  events.sort(byAt);

  const latest = new Map<number, number>(); // Strom i → aktueller Δ-Beitrag (Ziel-Einheit)
  const out: SeriesPoint[] = [];
  for (const e of events) {
    const s = streams[e.i];
    if (!s) continue;
    latest.set(e.i, (e.value - s.baseline) * s.dir * s.factor);
    let sum = 0;
    for (const v of latest.values()) sum += v;
    const abs = goalBaseline + goalDir * sum;
    const last = out[out.length - 1];
    if (last && last.at === e.at)
      last.value = abs; // ein Punkt je Termin
    else out.push({ at: e.at, value: abs });
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
 * `now` (ISO) markiert das Live-Ende für manual/KPI-Blätter. `liveEnd = false`
 * unterdrückt diesen „heute"-Punkt (z. B. bei einem geschlossenen Ziel — der
 * Verlauf endet dann am letzten echten Check-in).
 */
export function buildNodeProgressSeries(
  node: SeriesNode,
  now: string,
  liveEnd = true,
): ProgressPoint[] {
  const hasChildren = node.children.length > 0;

  if (aggregatesFromChildren(node.progressMode, hasChildren)) {
    // Asana-Logik: **stabiler Nenner**. Alle verbundenen Kinder (außer aus dem
    // automatischen Fortschritt entfernte) zählen durchgehend; vor ihrem ersten
    // Update stehen sie auf Baseline (Fortschritt 0), werden NICHT ausgeklammert.
    // So wechselt der Nenner nicht, wenn ein spät gestartetes Kind eintritt — keine
    // Kompositions-Delle; die Linie ist auf monotonen Eingaben monoton und ihr
    // rechter Rand deckt sich mit `nodeProgress` (dieselbe Rollup-Regel über die Zeit).
    const childSeries = node.children
      .filter((c) => c.includeInParentRollup)
      .map((c) => ({
        w: c.rollupWeight > 0 ? c.rollupWeight : 1,
        s: buildNodeProgressSeries(c, now, liveEnd),
      }))
      // Leere Serie = nie ein verwertbarer Fortschritt ⇒ ausklammern, exakt wie
      // `nodeProgress` Kinder mit `null` ausschließt (Serien-Ende = Kennzahl).
      .filter((cs) => cs.s.length > 0);
    const dates = [...new Set(childSeries.flatMap((cs) => cs.s.map((p) => p.at)))].sort();
    const out: ProgressPoint[] = [];
    for (const at of dates) {
      let wsum = 0;
      let acc = 0;
      for (const cs of childSeries) {
        const p = progressAt(cs.s, at) ?? 0; // vor erstem Update: Baseline 0, aber mitzählen
        wsum += cs.w;
        acc += cs.w * p;
      }
      if (wsum > 0) out.push({ at, progress: acc / wsum });
    }
    return out;
  }

  if (derivesCurrentFromKpis(node.progressMode, hasChildren)) {
    return buildAutoKpiSeries(
      { ...node.unitSpec, baseline: node.baseline, target: node.target },
      node.autoKpiLinks,
    ).map((p) => ({
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
  if (liveEnd && node.current != null && node.target != null) {
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
