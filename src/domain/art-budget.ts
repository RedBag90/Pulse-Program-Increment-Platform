/**
 * ART budget breakdown — pure helpers. The Value-Stream Finance distributes the
 * VS budget (derived per half-year from participatory budgeting) to the ARTs of
 * the stream. Two pure pieces:
 *
 *  - `aggregateArtFeatureLoad` — the decision-support load: per ART, the Feature
 *    count + Σ Job Size bucketed into the half-year of each Feature's PI, with a
 *    Backlog bucket for unscheduled Features.
 *  - `artBudgetRemaining` — VS budget − Σ ART allocations per period (mirrors
 *    `poolRemaining` for the participatory-budgeting pool, one level down).
 *
 * No I/O.
 */

import { halfYearKey } from "@/domain/calendar";

/** A Feature as the load aggregation needs it (Prisma rows normalised by the caller). */
export interface ArtFeatureInput {
  artId: string;
  /** The assigned PI's start date, or null when unscheduled (→ Backlog). */
  piStart: Date | null;
  /** WSJF Job Size (`wsjfJobSize`), 0 when unset. */
  jobSize: number;
}

/** Feature count + summed Job Size for one bucket. */
export interface LoadCell {
  count: number;
  jobSize: number;
}

export interface ArtFeatureLoad {
  artId: string;
  /** Load per half-year key (only periods that have features). */
  byPeriod: Record<string, LoadCell>;
  /** Features without a PI. */
  backlog: LoadCell;
  /** Load across all periods + backlog. */
  total: LoadCell;
}

const emptyCell = (): LoadCell => ({ count: 0, jobSize: 0 });

function addToCell(cell: LoadCell, jobSize: number): void {
  cell.count += 1;
  cell.jobSize += jobSize;
}

/**
 * Groups Features per ART into half-year buckets (by their PI's start) plus a
 * Backlog bucket (no PI). One entry per id in `artIds` — ARTs without Features
 * still appear with zeroed load. Features whose ART is not in `artIds` are ignored.
 */
export function aggregateArtFeatureLoad(
  artIds: readonly string[],
  features: readonly ArtFeatureInput[],
): ArtFeatureLoad[] {
  const byArt = new Map<string, ArtFeatureLoad>();
  for (const id of artIds) {
    byArt.set(id, { artId: id, byPeriod: {}, backlog: emptyCell(), total: emptyCell() });
  }
  for (const f of features) {
    const load = byArt.get(f.artId);
    if (!load) continue;
    const bucket = f.piStart
      ? (load.byPeriod[halfYearKey(f.piStart)] ??= emptyCell())
      : load.backlog;
    addToCell(bucket, f.jobSize);
    addToCell(load.total, f.jobSize);
  }
  return [...byArt.values()];
}

/**
 * Remaining VS budget per period = `vsByPeriod[key] − Σ artBudgets[*][key]`.
 * Negative means the ARTs are over-allocated against the Value Stream's budget.
 */
export function artBudgetRemaining(
  vsByPeriod: Record<string, number>,
  artBudgets: readonly Record<string, number>[],
  periodKeys: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of periodKeys) {
    const allocated = artBudgets.reduce((sum, b) => sum + (b[key] ?? 0), 0);
    out[key] = (vsByPeriod[key] ?? 0) - allocated;
  }
  return out;
}
