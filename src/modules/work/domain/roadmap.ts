/**
 * Roadmap timeframe maths — pure, UTC-based. Backs the Roadmaps module: derives
 * an Epic's span from its Features' PI windows, builds the month axis, and maps
 * a date range to a percentage offset for the Gantt bars.
 *
 * Month primitives (monthStart, addMonths, MONTH_LABELS) come from the calendar
 * module; this module keeps its own end-exclusive `GanttMonthSpan` shape (the
 * Gantt bars project a range onto a [start, end) span, not a month count).
 * Distinct from calendar's inclusive `MonthAxis` — the two are intentionally
 * not unified; the name says which semantics you get.
 */

import { monthStart, addMonths, MONTH_LABELS } from "@/modules/core/kernel/domain/calendar";
import type { FeatureDeliveryStatus as FeatureStatus } from "@/modules/work/domain/feature-status";

/** Deterministischer Anker für den degenerierten (leeren) Gantt-Span — kein
 *  Wall-Clock, hält das Modul rein (die months-Liste ist ohnehin leer). */
const EMPTY_SPAN_ANCHOR = monthStart(new Date(0));

export interface DateRange {
  start: Date;
  end: Date;
}

export interface GanttMonthSpan {
  /** First day of the earliest month (UTC). */
  start: Date;
  /** First day of the month after the latest month (UTC, exclusive). */
  end: Date;
  months: { key: string; label: string }[];
}

const nextMonth = (d: Date): Date => addMonths(d, 1);

/**
 * Earliest start / latest end across the ranges, ignoring `null` entries.
 * Returns `null` when no range is present — e.g. an Epic whose Features are all
 * unscheduled.
 */
export function deriveTimeframe(ranges: ReadonlyArray<DateRange | null>): DateRange | null {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const r of ranges) {
    if (!r) continue;
    if (start === null || r.start < start) start = r.start;
    if (end === null || r.end > end) end = r.end;
  }
  return start !== null && end !== null ? { start, end } : null;
}

/**
 * Month span (end-exclusive) covering every range from its earliest month to
 * the month after its latest. Empty input yields a degenerate span (no months).
 */
export function buildGanttMonthSpan(ranges: ReadonlyArray<DateRange>): GanttMonthSpan {
  if (ranges.length === 0) {
    return { start: EMPTY_SPAN_ANCHOR, end: EMPTY_SPAN_ANCHOR, months: [] };
  }

  let min = ranges[0]!.start;
  let max = ranges[0]!.end;
  for (const r of ranges) {
    if (r.start < min) min = r.start;
    if (r.end > max) max = r.end;
  }

  const start = monthStart(min);
  const end = nextMonth(max);
  const months: { key: string; label: string }[] = [];
  for (let cur = start; cur < end; cur = nextMonth(cur)) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    months.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[m]} ${y}`,
    });
  }
  return { start, end, months };
}

/**
 * Maps a range to `left`/`width` percentages of the axis span, clamped to
 * [0, 100] so a range reaching past the axis still renders inside it.
 */
export function barMetrics(
  range: DateRange,
  axis: GanttMonthSpan,
): { leftPct: number; widthPct: number } {
  const total = axis.end.getTime() - axis.start.getTime();
  if (total <= 0) return { leftPct: 0, widthPct: 0 };

  const clamp = (n: number): number => Math.min(100, Math.max(0, n));
  const left = clamp(((range.start.getTime() - axis.start.getTime()) / total) * 100);
  const right = clamp(((range.end.getTime() - axis.start.getTime()) / total) * 100);
  return { leftPct: left, widthPct: Math.max(0, right - left) };
}

// ---------------------------------------------------------------------------
// Roadmap view-model
//
// The render-ready rows + axis the Gantt consumes, built from the loaded
// initiative rows (the loading stays in `roadmap` service). One pure builder
// per perspective — Portfolio (Epics), ART (Features), Value Stream (Epics with
// their Features, grouped hierarchically or by ART) — plus `roadmapAxis`, which
// hides the "ranges of scheduled rows → month axis" derivation that every page
// used to repeat. Inputs are structural, so this module stays Prisma-free.
// ---------------------------------------------------------------------------

/**
 * One Gantt row: a label track entry with an optional bar (`range`). For Epic
 * rows that carry an owner-set Soll-Fenster, `range` is the Soll and
 * `derivedRange` (when set) is the Ist computed from the Features' PIs — the
 * renderer draws them stacked, Soll prominently and Ist as a faded overlay.
 */
/**
 * Optionaler Akzent fuer die Render-Schicht. Bei `undefined` faellt der
 * Renderer auf den `kind`-Default zurueck (`epic` indigo, `feature` sky).
 * Caller mit reichhaltigerem Kontext (Cockpit-Roadmap: Feature-Status)
 * kippen den Akzent semantisch um.
 */
export type RoadmapRowAccent = FeatureStatus | "epic" | "feature";

export interface RoadmapRow {
  id: string;
  label: string;
  sublabel?: string | undefined;
  href?: string | undefined;
  range: DateRange | null;
  /** Secondary band — present only on Epic rows when both Soll and Ist exist. */
  derivedRange?: DateRange | null;
  depth: 0 | 1;
  kind: "epic" | "feature" | "group";
  /** Optional render-hint fuer die Bar-Farbe; ohne Wert greift der
   *  `kind`-Default im Renderer. */
  accent?: RoadmapRowAccent | undefined;
}

/**
 * The PI window a Feature is scheduled into — just the (inklusive) Datums-Range.
 * Eigenständig gehalten, damit dieses Work-View nicht ins Drumbeat-Modul greift
 * (ADR-0013); strukturell kompatibel zum Cadence-`PiWindow`.
 */
export interface PiWindow {
  startDate: Date;
  endDate: Date;
}

const piRange = (pi: PiWindow | null): DateRange | null =>
  pi ? { start: pi.startDate, end: pi.endDate } : null;

/** End-exclusive Gantt span covering the scheduled rows; unscheduled rows are ignored. */
export function roadmapAxis(rows: readonly RoadmapRow[]): GanttMonthSpan {
  // Include both bars (Soll + Ist) so the axis covers any Ist overlay that
  // extends beyond the Epic's Soll-Fenster.
  const allRanges: DateRange[] = [];
  for (const r of rows) {
    if (r.range) allRanges.push(r.range);
    if (r.derivedRange) allRanges.push(r.derivedRange);
  }
  return buildGanttMonthSpan(allRanges);
}

// --- Portfolio: one row per Epic, timed via its Features' PI windows ---------

export interface PortfolioRoadmapEpic {
  id: string;
  title: string;
  valueStream: { name: string } | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  children: { pi: PiWindow | null }[];
}

/** Picks Soll for the primary bar; falls back to the derived Ist when no Soll. */
function epicBars(
  e: { plannedStartAt: Date | null; plannedEndAt: Date | null },
  derived: DateRange | null,
): { range: DateRange | null; derivedRange: DateRange | null } {
  if (e.plannedStartAt && e.plannedEndAt) {
    return {
      range: { start: e.plannedStartAt, end: e.plannedEndAt },
      derivedRange: derived,
    };
  }
  return { range: derived, derivedRange: null };
}

export function portfolioRoadmapRows(epics: readonly PortfolioRoadmapEpic[]): RoadmapRow[] {
  return epics.map((e) => {
    const derived = deriveTimeframe(e.children.map((c) => piRange(c.pi)));
    const { range, derivedRange } = epicBars(e, derived);
    return {
      id: e.id,
      label: e.title,
      sublabel: e.valueStream?.name,
      href: `/portfolio/epics/${e.id}`,
      range,
      derivedRange,
      depth: 0,
      kind: "epic",
    };
  });
}

// --- ART: one row per Feature, timed via its assigned PI ---------------------

export interface ArtRoadmapFeature {
  id: string;
  title: string;
  parent: { title: string } | null;
  pi: PiWindow | null;
}

export function artRoadmapRows(features: readonly ArtRoadmapFeature[]): RoadmapRow[] {
  return features.map((f) => ({
    id: f.id,
    label: f.title,
    sublabel: f.parent?.title,
    href: `/feature/${f.id}`,
    range: piRange(f.pi),
    depth: 0,
    kind: "feature",
  }));
}

// --- shared grouping ---------------------------------------------------------

/**
 * Group-into-Map + emit-header-then-children — the loop that both the Cockpit
 * (Features by parent-Epic) and the by-ART Value-Stream view repeated. Items
 * are bucketed by `keyOf` (insertion order preserved); each bucket emits a
 * header row followed by its child rows. Items whose `keyOf` is `null` collect
 * in an optional orphan bucket rendered last (only when `opts.orphanRow` is
 * given and at least one orphan exists). The per-view `RoadmapRow` shaping stays
 * with the caller via the `makeHeaderRow` / `makeChildRow` callbacks.
 */
export function groupIntoHeaderRows<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K | null,
  makeHeaderRow: (key: K, groupItems: readonly T[]) => RoadmapRow,
  makeChildRow: (item: T) => RoadmapRow,
  opts?: { orphanRow?: () => RoadmapRow },
): RoadmapRow[] {
  const groups = new Map<K, T[]>();
  const orphans: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) {
      orphans.push(item);
      continue;
    }
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const rows: RoadmapRow[] = [];
  for (const [key, groupItems] of groups) {
    rows.push(makeHeaderRow(key, groupItems));
    for (const item of groupItems) rows.push(makeChildRow(item));
  }
  if (opts?.orphanRow && orphans.length > 0) {
    rows.push(opts.orphanRow());
    for (const item of orphans) rows.push(makeChildRow(item));
  }
  return rows;
}

// --- Cockpit: Features grouped by parent-Epic ------------------------------

export interface CockpitRoadmapFeature {
  id: string;
  title: string;
  parentId: string | null;
  parentTitle: string | null;
  pi: PiWindow | null;
  accent?: RoadmapRowAccent | undefined;
}

/**
 * Cockpit-Roadmap-Rows mit Epic-Grouping (Linear/Productboard-Pattern):
 * Pro Parent-Epic ein Epic-Header (Soll = `deriveTimeframe` ueber alle
 * Feature-PIs), darunter alle Features 1-Level indented. Features ohne
 * Parent landen in einer „Ohne Epic"-Sammelgruppe am Ende.
 */
const cockpitFeatureRow = (f: CockpitRoadmapFeature): RoadmapRow => ({
  id: f.id,
  label: f.title,
  href: `/feature/${f.id}`,
  range: piRange(f.pi),
  depth: 1,
  kind: "feature",
  accent: f.accent,
});

export function cockpitRoadmapRows(features: readonly CockpitRoadmapFeature[]): RoadmapRow[] {
  return groupIntoHeaderRows(
    features,
    (f) => (f.parentId === null || f.parentTitle === null ? null : f.parentId),
    (parentId, items) => ({
      id: parentId,
      label: items[0]!.parentTitle!,
      href: `/portfolio/epics/${parentId}`,
      range: deriveTimeframe(items.map((f) => piRange(f.pi))),
      depth: 0,
      kind: "epic",
      accent: "epic",
    }),
    cockpitFeatureRow,
    {
      orphanRow: () => ({
        id: "__orphans__",
        label: "Ohne Epic",
        range: null,
        depth: 0,
        kind: "group",
      }),
    },
  );
}

// --- Value Stream: Epics + their Features, hierarchical or grouped by ART ----

export type RoadmapGrouping = "epic" | "art";

export interface ValueStreamRoadmapFeature {
  id: string;
  title: string;
  artId: string | null;
  art: { name: string } | null;
  pi: PiWindow | null;
}

export interface ValueStreamRoadmapEpic {
  id: string;
  title: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  children: ValueStreamRoadmapFeature[];
}

/** Hierarchical view: each Epic followed by its indented Features. */
function vsEpicGroupedRows(epics: readonly ValueStreamRoadmapEpic[]): RoadmapRow[] {
  const rows: RoadmapRow[] = [];
  for (const e of epics) {
    const derived = deriveTimeframe(e.children.map((f) => piRange(f.pi)));
    const { range, derivedRange } = epicBars(e, derived);
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range,
      derivedRange,
      depth: 0,
      kind: "epic",
    });
    for (const f of e.children) {
      rows.push({
        id: f.id,
        label: f.title,
        sublabel: f.art?.name,
        href: `/feature/${f.id}`,
        range: piRange(f.pi),
        depth: 1,
        kind: "feature",
      });
    }
  }
  return rows;
}

/** By-ART view: an Epics section, then one section per ART. */
function vsArtGroupedRows(epics: readonly ValueStreamRoadmapEpic[]): RoadmapRow[] {
  const rows: RoadmapRow[] = [
    { id: "__epics__", label: "Epics", range: null, depth: 0, kind: "group" },
  ];
  for (const e of epics) {
    const derived = deriveTimeframe(e.children.map((f) => piRange(f.pi)));
    const { range, derivedRange } = epicBars(e, derived);
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range,
      derivedRange,
      depth: 0,
      kind: "epic",
    });
  }

  const artRows = groupIntoHeaderRows(
    epics.flatMap((e) => e.children),
    (f) => f.artId ?? "__none__",
    (key, items) => ({
      id: `art-${key}`,
      label: items[0]!.art?.name ?? "Ohne ART",
      range: null,
      depth: 0,
      kind: "group",
    }),
    (f) => ({
      id: f.id,
      label: f.title,
      href: `/feature/${f.id}`,
      range: piRange(f.pi),
      depth: 1,
      kind: "feature",
    }),
  );
  return [...rows, ...artRows];
}

export function valueStreamRoadmapRows(
  epics: readonly ValueStreamRoadmapEpic[],
  grouping: RoadmapGrouping,
): RoadmapRow[] {
  return grouping === "art" ? vsArtGroupedRows(epics) : vsEpicGroupedRows(epics);
}
