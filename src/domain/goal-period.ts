/**
 * Ziel-Zeiträume (Objective + Key Result). Ein Period-Key ist genau eine von
 * drei kanonischen Formen (Kalenderquartale, UTC):
 *
 *   Quartal   `YYYY-Qn`  (n = 1..4)
 *   Halbjahr  `YYYY-Hn`  (n = 1..2)  H1 = Q1+Q2, H2 = Q3+Q4
 *   Ganzjahr  `YYYY`
 *
 * `null` = Backlog / kein Zeitraum. Einzige Quelle der Quartals-/Halbjahres-/
 * Jahres-Mathematik für das Ziele-Modul (getrennt von `calendar.ts`, das die
 * Budget-Halbjahre macht). Reine Funktionen, kein I/O.
 */

export type PeriodGranularity = "year" | "half" | "quarter";

export interface GoalPeriod {
  year: number;
  granularity: PeriodGranularity;
  /** Quartal 1..4, Halbjahr 1..2, Ganzjahr `null`. */
  index: number | null;
}

const YEAR_RE = /^(\d{4})$/;
const HALF_RE = /^(\d{4})-H([12])$/;
const QUARTER_RE = /^(\d{4})-Q([1-4])$/;

const MONTHS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/** Ist `s` ein gültiger kanonischer Period-Key? */
export function isGoalPeriodKey(s: string): boolean {
  return parseGoalPeriod(s) !== null;
}

/** Parst einen Period-Key; `null` bei malformer Eingabe. */
export function parseGoalPeriod(key: string): GoalPeriod | null {
  const q = QUARTER_RE.exec(key);
  if (q) return { year: Number(q[1]), granularity: "quarter", index: Number(q[2]) };
  const h = HALF_RE.exec(key);
  if (h) return { year: Number(h[1]), granularity: "half", index: Number(h[2]) };
  const y = YEAR_RE.exec(key);
  if (y) return { year: Number(y[1]), granularity: "year", index: null };
  return null;
}

/** Kanonischer Key aus einem GoalPeriod. */
export function formatGoalPeriodKey(p: GoalPeriod): string {
  if (p.granularity === "quarter") return `${p.year}-Q${p.index}`;
  if (p.granularity === "half") return `${p.year}-H${p.index}`;
  return `${p.year}`;
}

/**
 * Anzeige-Label. Nimmt einen Key ODER ein GoalPeriod. Bei malformem Key wird
 * der Rohstring unverändert zurückgegeben (Rückwärtskompatibilität für
 * Altwerte wie „q4-26").
 */
export function goalPeriodLabel(keyOrPeriod: string | GoalPeriod): string {
  const p = typeof keyOrPeriod === "string" ? parseGoalPeriod(keyOrPeriod) : keyOrPeriod;
  if (!p) return keyOrPeriod as string;
  if (p.granularity === "quarter") return `Q${p.index} ${p.year}`;
  if (p.granularity === "half") return `H${p.index} ${p.year}`;
  return `FY ${p.year}`;
}

/** Start-/End-Monat (0..11) eines Periods innerhalb seines Jahres. */
function monthSpan(p: GoalPeriod): { startMonth: number; endMonth: number } {
  if (p.granularity === "quarter") {
    const start = ((p.index ?? 1) - 1) * 3;
    return { startMonth: start, endMonth: start + 2 };
  }
  if (p.granularity === "half") {
    const start = (p.index ?? 1) === 1 ? 0 : 6;
    return { startMonth: start, endMonth: start + 5 };
  }
  return { startMonth: 0, endMonth: 11 };
}

/** UTC-Zeitspanne [start, end) — start inklusiv, end exklusiv (Monatsgrenzen). */
export function goalPeriodRange(p: GoalPeriod): { start: Date; end: Date } {
  const { startMonth, endMonth } = monthSpan(p);
  return {
    start: new Date(Date.UTC(p.year, startMonth, 1)),
    end: new Date(Date.UTC(p.year, endMonth + 1, 1)),
  };
}

/** Kurzes Datums-Label, z. B. „Jul – Sep 2026" bzw. „Jan – Dez 2026". */
export function goalPeriodDateLabel(keyOrPeriod: string | GoalPeriod): string {
  const p = typeof keyOrPeriod === "string" ? parseGoalPeriod(keyOrPeriod) : keyOrPeriod;
  if (!p) return "";
  const { startMonth, endMonth } = monthSpan(p);
  return `${MONTHS_DE[startMonth]} – ${MONTHS_DE[endMonth]} ${p.year}`;
}

/** Aktuelles Kalenderquartal (UTC). */
export function currentGoalPeriod(now = new Date()): GoalPeriod {
  return {
    year: now.getUTCFullYear(),
    granularity: "quarter",
    index: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

/**
 * Mappt einen Period-Key auf sein **Start-Quartal** (`YYYY-Qn`). Damit können
 * OKR-Board-Spalten H1/H2/FY-Ziele im richtigen Quartal einsortieren statt sie
 * in den Backlog fallen zu lassen. `null` bei malformem Key.
 */
export function anchorQuarterKey(key: string): string | null {
  const p = parseGoalPeriod(key);
  if (!p) return null;
  if (p.granularity === "quarter") return `${p.year}-Q${p.index}`;
  if (p.granularity === "half") return `${p.year}-Q${p.index === 1 ? 1 : 3}`;
  return `${p.year}-Q1`;
}

/** Sortier-Vergleich nach Start-Zeitpunkt, dann Endzeitpunkt (kürzeres zuerst). */
export function compareGoalPeriod(a: GoalPeriod, b: GoalPeriod): number {
  const ra = goalPeriodRange(a);
  const rb = goalPeriodRange(b);
  return ra.start.getTime() - rb.start.getTime() || ra.end.getTime() - rb.end.getTime();
}
