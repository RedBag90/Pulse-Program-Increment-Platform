/**
 * Perioden-Fenster — die Regeln, WELCHE Halbjahre eine Sicht zeigt.
 *
 * Das Modul hatte vier solcher Regeln, alle inline an ihrer Verwendungsstelle
 * und keine davon benannt oder einzeln testbar:
 *
 *  - `forecastAxis`          — der Board-Horizont (frühester Bedarf/Topf → spätestes Ende)
 *  - `budgetPlusLoadPeriods` — die ART-Breakdown-Spalten (Budget-Perioden ∪ PI-Halbjahre)
 *  - `occupiedWindow`        — das Snapshot-Raster (nur Perioden MIT Daten, kein Zero-Padding)
 *  - `computeDisplayPeriods` — die Revisions-Spalten (Vorgänger + Zyklus + spätere)
 *
 * Bewusst vier Funktionen und nicht eine parametrisierte: die Regeln sind
 * fachlich verschieden (Prognose vs. Ist-Belegung vs. „ab hier geht es weiter"),
 * nur ihr Ergebnistyp ist ähnlich. Vgl. ADR-0005 — „benenne die Politik, statt
 * sie zu parametrisieren".
 *
 * Rein, kein I/O; „heute" wird injiziert.
 */

import {
  halfYearKey,
  halfYearLabel,
  halfYearStart,
  parseHalfYearKey,
  addHalfYears,
  buildHalfYearAxis,
  type HalfYearAxis,
} from "@/modules/core/kernel/domain/calendar";
import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";

/** Eine Spalte: Halbjahres-Key + Anzeigelabel. */
export interface Period {
  key: string;
  label: string;
}

const period = (key: string): Period => ({ key, label: halfYearLabel(key) });

/** Sortierte, deduplizierte Spalten aus einer Key-Menge (Keys sortieren lexikalisch). */
function periodsFromKeys(keys: Iterable<string>): Period[] {
  return [...new Set(keys)].sort().map(period);
}

// ---------------------------------------------------------------------------
// 1) Board-Prognosehorizont
// ---------------------------------------------------------------------------

/** Ein Epic, so wie der Horizont es braucht: wann es startet und wie viele Halbjahre es läuft. */
export interface ForecastSpan {
  /** Halbjahres-Key des Bedarfsbeginns, z. B. "2026-H1". */
  startKey: string;
  /** Anzahl belegter Halbjahre, mindestens 1. */
  spanPeriods: number;
}

/**
 * Der Prognosehorizont des Boards: vom frühesten Epic-Start bzw. der frühesten
 * Topf-Periode bis zum spätesten Bedarfsende bzw. der spätesten Topf-Periode,
 * lückenlos.
 *
 * Bewusst **tenant-weit** und nicht je Wertstrom — sonst verschöben sich die
 * Spalten je nach Filter und zwei Sichten zeigten dieselbe Zahl in verschiedenen
 * Spalten. Ohne jede Datenlage fällt der Horizont auf das Halbjahr von `now`.
 */
export function forecastAxis(
  spans: readonly ForecastSpan[],
  poolKeys: readonly string[],
  now: Date,
): HalfYearAxis {
  const startDates = spans
    .map((s) => parseHalfYearKey(s.startKey))
    .filter((d): d is Date => d != null);
  const poolDates = poolKeys.map((k) => parseHalfYearKey(k)).filter((d): d is Date => d != null);

  const lows = [...startDates, ...poolDates];
  const from = lows.length ? lows.reduce((m, d) => (d < m ? d : m)) : halfYearStart(now);

  const ends = spans.map((s) => {
    const start = parseHalfYearKey(s.startKey) ?? from;
    return addHalfYears(start, Math.max(1, s.spanPeriods) - 1);
  });
  const to = [...ends, ...poolDates].reduce((m, d) => (d > m ? d : m), from);

  return buildHalfYearAxis(from, to);
}

// ---------------------------------------------------------------------------
// 2) ART-Breakdown-Spalten
// ---------------------------------------------------------------------------

/**
 * Die Spalten des ART-Breakdowns: die Budget-Perioden des Wertstroms **∪** jedes
 * Halbjahr, in das der PI eines Features fällt. Die Vereinigung ist der Punkt —
 * so bleibt Feature-Last sichtbar, für die noch gar kein Budget geplant ist.
 */
export function budgetPlusLoadPeriods(
  budgetKeys: readonly string[],
  featurePiStarts: readonly Date[],
): Period[] {
  return periodsFromKeys([...budgetKeys, ...featurePiStarts.map(halfYearKey)]);
}

// ---------------------------------------------------------------------------
// 3) Snapshot-Raster
// ---------------------------------------------------------------------------

/** Eine belegte Snapshot-Periode: Spalte + Σ aller Beträge darin. */
export interface OccupiedPeriod extends Period {
  total: number;
}

/**
 * Das Perioden-Fenster eines Snapshots, in zwei Ausprägungen aus **einer**
 * Key-Menge:
 *
 *  - `periods` — das **sparse** Raster: nur Halbjahre, die tatsächlich Daten
 *    tragen (Epic-Allokation, ART-Budget oder Topf). Kein Zero-Padding, damit
 *    ein Snapshot selbsttragend bleibt und keine leeren Spalten einfriert.
 *  - `axis` — die **lückenlose** Spanne über dieselben Keys, für die
 *    Roll-up-Primitive (`rollupByValueStream`), die eine Achse zum Filtern
 *    brauchen. Weil sie aus derselben Menge stammt, verwirft ihr Filter nichts,
 *    was das Raster zeigt.
 *
 * Ohne jede Datenlage spannen beide über `fallback` (den Erfassungszeitpunkt).
 */
export function occupiedWindow(
  totals: PeriodAmounts,
  fallback: Date,
): { periods: OccupiedPeriod[]; axis: HalfYearAxis } {
  const keys = Object.keys(totals).sort();
  const periods: OccupiedPeriod[] = keys.map((key) => ({ ...period(key), total: totals[key]! }));

  const dates = keys.map((k) => parseHalfYearKey(k)).filter((d): d is Date => d != null);
  const from = dates.length ? dates.reduce((m, d) => (d < m ? d : m)) : fallback;
  const to = dates.length ? dates.reduce((m, d) => (d > m ? d : m)) : fallback;

  return { periods, axis: buildHalfYearAxis(from, to) };
}

// ---------------------------------------------------------------------------
// 4) Revisions-Spalten
// ---------------------------------------------------------------------------

/** Eine sichtbare Halbjahres-Spalte der Revisions-Sicht (erfasster Zyklus markiert). */
export interface SnapshotDisplayPeriod extends Period {
  isCurrent: boolean;
}

/**
 * Die sichtbaren Spalten einer Revision: das Halbjahr **unmittelbar vor** dem
 * erfassten Zyklus (Anker), der Zyklus selbst, und jedes spätere Halbjahr mit
 * Daten. Ältere Historie bleibt ausgeblendet, damit die Tabelle auf „wie geht es
 * weiter" ankert statt auf „was war".
 */
export function computeDisplayPeriods(snapshot: {
  cycleKey: string;
  periods: readonly { key: string }[];
}): SnapshotDisplayPeriod[] {
  const cycleStart = parseHalfYearKey(snapshot.cycleKey);
  const previousKey = cycleStart ? halfYearKey(addHalfYears(cycleStart, -1)) : null;

  const keys = new Set<string>();
  if (previousKey) keys.add(previousKey);
  keys.add(snapshot.cycleKey);
  for (const p of snapshot.periods) {
    if (p.key >= snapshot.cycleKey) keys.add(p.key);
  }

  return periodsFromKeys(keys).map((p) => ({ ...p, isCurrent: p.key === snapshot.cycleKey }));
}
