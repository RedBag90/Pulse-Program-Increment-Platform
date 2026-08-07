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

// ── Umsetzungszeitraum: Bucket (FY/H/Q) ODER individueller Start–Ende-Bereich ──

/**
 * Effektiver Umsetzungszeitraum eines Ziels: entweder ein individueller Bereich
 * (`periodStart`/`periodEnd` gesetzt) — der **gewinnt** — oder der kanonische
 * Bucket `period`. Beide leer ⇒ `null`. `start`/`end` inklusiv im Sinne des
 * gewählten Datums; für Überlappungs-/Balken-Mathematik als [start, end) genutzt.
 */
export type GoalTimeframe =
  | { kind: "range"; start: Date; end: Date }
  | { kind: "bucket"; key: string; start: Date; end: Date };

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function goalTimeframe(
  period: string | null | undefined,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): GoalTimeframe | null {
  const s = toDate(start);
  const e = toDate(end);
  if (s && e) return { kind: "range", start: s, end: e };
  if (period) {
    const p = parseGoalPeriod(period);
    if (p) {
      const r = goalPeriodRange(p);
      return { kind: "bucket", key: period, start: r.start, end: r.end };
    }
  }
  return null;
}

/** Anzeige-Label: Bucket → „Q3 2026"; Range → „1. Mär – 30. Jun 2026". */
export function goalTimeframeLabel(tf: GoalTimeframe | null): string {
  if (!tf) return "—";
  if (tf.kind === "bucket") return goalPeriodLabel(tf.key);
  const fmt = (d: Date): string => `${d.getUTCDate()}. ${MONTHS_DE[d.getUTCMonth()]}`;
  const sy = tf.start.getUTCFullYear();
  const ey = tf.end.getUTCFullYear();
  return sy === ey
    ? `${fmt(tf.start)} – ${fmt(tf.end)} ${ey}`
    : `${fmt(tf.start)} ${sy} – ${fmt(tf.end)} ${ey}`;
}

/** Sortier-Key nach Startzeitpunkt; ohne Zeitraum ans Ende. */
export function goalTimeframeStart(tf: GoalTimeframe | null): number {
  return tf ? tf.start.getTime() : Number.POSITIVE_INFINITY;
}

/** Überlappen sich [aStart, aEnd) und [bStart, bEnd)? */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
