/**
 * Roadmap timeframe maths — pure, UTC-based. Backs the Roadmaps module: derives
 * an Epic's span from its Features' PI windows, builds the month axis, and maps
 * a date range to a percentage offset for the Gantt bars.
 *
 * Month primitives (monthStart, addMonths, MONTH_LABELS) come from the calendar
 * module; this module keeps its own end-exclusive `MonthAxis` shape (the Gantt
 * bars project a range onto a [start, end) span, not a month count).
 */

import { monthStart, addMonths, MONTH_LABELS } from "@/domain/calendar";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MonthAxis {
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
 * Month axis spanning from the earliest range's month to the latest range's
 * month. Empty input yields an axis with no months (degenerate span).
 */
export function buildMonthAxis(ranges: ReadonlyArray<DateRange>): MonthAxis {
  if (ranges.length === 0) {
    const now = monthStart(new Date());
    return { start: now, end: now, months: [] };
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
  axis: MonthAxis,
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

/** One Gantt row: a label track entry with an optional bar (`range`). */
export interface RoadmapRow {
  id: string;
  label: string;
  sublabel?: string | undefined;
  href?: string | undefined;
  range: DateRange | null;
  depth: 0 | 1;
  kind: "epic" | "feature" | "group";
}

/** The PI window a Feature is scheduled into (structural; extra fields ignored). */
export interface PiWindow {
  startDate: Date;
  endDate: Date;
}

const piRange = (pi: PiWindow | null): DateRange | null =>
  pi ? { start: pi.startDate, end: pi.endDate } : null;

/** Inclusive month axis spanning the scheduled rows; unscheduled rows are ignored. */
export function roadmapAxis(rows: readonly RoadmapRow[]): MonthAxis {
  return buildMonthAxis(rows.map((r) => r.range).filter((r): r is DateRange => r !== null));
}

// --- Portfolio: one row per Epic, timed via its Features' PI windows ---------

export interface PortfolioRoadmapEpic {
  id: string;
  title: string;
  valueStream: { name: string } | null;
  children: { pi: PiWindow | null }[];
}

export function portfolioRoadmapRows(epics: readonly PortfolioRoadmapEpic[]): RoadmapRow[] {
  return epics.map((e) => ({
    id: e.id,
    label: e.title,
    sublabel: e.valueStream?.name,
    href: `/portfolio/epics/${e.id}`,
    range: deriveTimeframe(e.children.map((c) => piRange(c.pi))),
    depth: 0,
    kind: "epic",
  }));
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
  children: ValueStreamRoadmapFeature[];
}

/** Hierarchical view: each Epic followed by its indented Features. */
function vsEpicGroupedRows(epics: readonly ValueStreamRoadmapEpic[]): RoadmapRow[] {
  const rows: RoadmapRow[] = [];
  for (const e of epics) {
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range: deriveTimeframe(e.children.map((f) => piRange(f.pi))),
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
    rows.push({
      id: e.id,
      label: e.title,
      href: `/portfolio/epics/${e.id}`,
      range: deriveTimeframe(e.children.map((f) => piRange(f.pi))),
      depth: 0,
      kind: "epic",
    });
  }

  const byArt = new Map<string, { name: string; features: ValueStreamRoadmapFeature[] }>();
  for (const f of epics.flatMap((e) => e.children)) {
    const key = f.artId ?? "__none__";
    if (!byArt.has(key)) byArt.set(key, { name: f.art?.name ?? "Ohne ART", features: [] });
    byArt.get(key)!.features.push(f);
  }
  for (const [key, group] of byArt) {
    rows.push({ id: `art-${key}`, label: group.name, range: null, depth: 0, kind: "group" });
    for (const f of group.features) {
      rows.push({
        id: f.id,
        label: f.title,
        href: `/feature/${f.id}`,
        range: piRange(f.pi),
        depth: 1,
        kind: "feature",
      });
    }
  }
  return rows;
}

export function valueStreamRoadmapRows(
  epics: readonly ValueStreamRoadmapEpic[],
  grouping: RoadmapGrouping,
): RoadmapRow[] {
  return grouping === "art" ? vsArtGroupedRows(epics) : vsEpicGroupedRows(epics);
}
