/**
 * Pure PI × status-lane matrix for the Delivery-Board (Drumbeat).
 *
 * The board re-buckets on every optimistic drag-drop, so the matrix CANNOT
 * be purely server-emitted — it has to be recomputed client-side from the
 * optimistic feature list. This module owns three things that used to live
 * inline in `cockpit-board.tsx` (and were copy-pasted into `cockpit-table.tsx`):
 *   1. the synthetic Backlog column (features with `piId === null`),
 *   2. the ONE canonical `null ↔ ""` PI-key normalization (`normalizePiKey`),
 *   3. the per-cell membership bucketing (was an O(lanes×cols×features) inline
 *      `filter` in render).
 *
 * Pure: no I/O, no React, no wall-clock Date. The Backlog column carries a
 * constant epoch placeholder date only to satisfy `CockpitPiSlot` — it is
 * never rendered as a real timeline window.
 */

import type { CockpitFeature, CockpitPiSlot, FeatureStatus } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/** Column id of the synthetic Backlog column — also the empty PI-key. */
export const BACKLOG_COLUMN_ID = "";

/** Lane descriptor the matrix buckets against (structurally the board's `LaneDef`). */
export interface BoardLane {
  value: FeatureStatus;
  label: string;
  color: string;
}

/**
 * Single owner of the `null ↔ ""` PI-key normalization. A feature with no PI
 * (`piId === null`) belongs to the Backlog column, whose id is the empty string;
 * every call site that compares a feature's PI against a column id MUST route
 * through here so the Backlog column is matched consistently.
 */
export function normalizePiKey(piId: string | null | undefined): string {
  return piId ?? BACKLOG_COLUMN_ID;
}

export interface BoardMatrix {
  /** Backlog column first, then the PI columns (unchanged, server-counted). */
  columns: CockpitPiSlot[];
  lanes: readonly BoardLane[];
  /** Bucketed features keyed by `${piKey}:${status}`. */
  cells: Map<string, CockpitFeature[]>;
  /** Features sitting in the `(columnId, status)` cell (empty array if none). */
  cell(columnId: string, status: FeatureStatus): CockpitFeature[];
}

function cellKey(columnId: string, status: FeatureStatus): string {
  return `${columnId}:${status}`;
}

/**
 * Build the PI × status-lane matrix for the given feature snapshot.
 *
 * `pis` are the real PI columns (already carrying their server feature counts);
 * the Backlog column is synthesized here and its count is derived from the
 * passed features (so it tracks the optimistic view, matching prior behavior).
 */
export function buildBoardMatrix(
  features: readonly CockpitFeature[],
  pis: readonly CockpitPiSlot[],
  lanes: readonly BoardLane[],
): BoardMatrix {
  const backlogCount = features.reduce((n, f) => (f.piId == null ? n + 1 : n), 0);
  const backlogColumn: CockpitPiSlot = {
    id: BACKLOG_COLUMN_ID,
    name: "Backlog",
    startDate: new Date(0),
    endDate: new Date(0),
    status: "backlog",
    featureCount: backlogCount,
    isCurrent: false,
  };
  const columns: CockpitPiSlot[] = [backlogColumn, ...pis];

  const cells = new Map<string, CockpitFeature[]>();
  for (const f of features) {
    const key = cellKey(normalizePiKey(f.piId), f.status);
    const bucket = cells.get(key);
    if (bucket) bucket.push(f);
    else cells.set(key, [f]);
  }

  return {
    columns,
    lanes,
    cells,
    cell(columnId: string, status: FeatureStatus): CockpitFeature[] {
      return cells.get(cellKey(columnId, status)) ?? [];
    },
  };
}
