/**
 * Pure, library-free layout math for the Drumbeat dependency graphs.
 *
 * `swimlaneLayout` — PI-swimlane bucketing (the "PI-Bahnen" mode of the
 * Epic-Breakdown network).
 *
 * Pure: no React, no dagre, no I/O, no Date. The dagre-based layouts stay in
 * their client components (library boundary); only this hand-rolled algorithm
 * is shared.
 */

import { NODE_W_BREAKDOWN } from "@/modules/drumbeat/domain/graph-constants";

// ---------------------------------------------------------------------------
// swimlaneLayout — PI-swimlane bucketing (Epic-Breakdown "PI-Bahnen" mode)
// ---------------------------------------------------------------------------

/** Breakdown node height + swimlane geometry. */
const BREAKDOWN_NODE_H = 96;
const SWIMLANE_COL_WIDTH = NODE_W_BREAKDOWN + 160;
const SWIMLANE_HEADER_HEIGHT = 40;
const SWIMLANE_ROW_GAP = 60;
const SWIMLANE_FIRST_ROW_Y = SWIMLANE_HEADER_HEIGHT + 16;

export interface SwimlaneNode {
  id: string;
  piId: string | null;
}

export interface SwimlanePi {
  id: string;
  name: string;
  startDate: string;
}

export interface SwimlaneHeader {
  col: number;
  label: string;
  x: number;
  y: number;
}

export interface SwimlanePosition {
  id: string;
  x: number;
  y: number;
}

export interface SwimlaneLayout {
  headers: SwimlaneHeader[];
  features: SwimlanePosition[];
  ghosts: SwimlanePosition[];
}

/**
 * Bucket feature nodes into swimlane columns:
 *   [Backlog, PI_1, PI_2, …, PI_n, Cross-Epic]
 * A node's column is its PI's position (in `pis` order), Backlog (col 0) when
 * it has no PI, and every ghost node lands in the rightmost "Cross-Epic"
 * column. Items stack vertically within their column, below a per-column
 * header. Returns positions only — edges are unaffected (drawn by ReactFlow).
 */
export function swimlaneLayout(
  nodes: readonly SwimlaneNode[],
  ghostNodes: readonly { id: string }[],
  pis: readonly SwimlanePi[],
): SwimlaneLayout {
  // Column index: 0 = Backlog, 1..n = PIs in startDate order, n+1 = Cross-Epic.
  const colByPi = new Map<string, number>();
  pis.forEach((p, i) => colByPi.set(p.id, i + 1));
  const externCol = pis.length + 1;

  // Buckets per column index.
  const buckets = new Map<number, { featureId?: string; ghostId?: string }[]>();
  for (let i = 0; i <= externCol; i++) buckets.set(i, []);

  for (const n of nodes) {
    const col = n.piId == null ? 0 : (colByPi.get(n.piId) ?? 0);
    buckets.get(col)!.push({ featureId: n.id });
  }
  for (const gn of ghostNodes) {
    buckets.get(externCol)!.push({ ghostId: gn.id });
  }

  // Header labels per column.
  const headerLabels: Record<number, string> = { 0: "Backlog", [externCol]: "Cross-Epic" };
  for (const p of pis) headerLabels[colByPi.get(p.id)!] = p.name;

  const headers: SwimlaneHeader[] = [];
  for (let col = 0; col <= externCol; col++) {
    headers.push({
      col,
      label: headerLabels[col] ?? "—",
      x: col * SWIMLANE_COL_WIDTH,
      y: 0,
    });
  }

  const features: SwimlanePosition[] = [];
  const ghosts: SwimlanePosition[] = [];
  for (const [col, items] of buckets) {
    items.forEach((item, idx) => {
      const x = col * SWIMLANE_COL_WIDTH;
      const y = SWIMLANE_FIRST_ROW_Y + idx * (BREAKDOWN_NODE_H + SWIMLANE_ROW_GAP);
      if (item.featureId != null) features.push({ id: item.featureId, x, y });
      else if (item.ghostId != null) ghosts.push({ id: item.ghostId, x, y });
    });
  }

  return { headers, features, ghosts };
}
