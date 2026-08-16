/**
 * Pure, library-free layout math for the Drumbeat dependency graphs.
 *
 * Two algorithms live here, both extracted verbatim (behavior-preserving)
 * from graph components:
 *   - `rankLayout`    — BFS longest-path rank + column bucketing (the compact
 *                       PI SVG in `features/pi/components/dependency-graph.tsx`).
 *   - `swimlaneLayout`— PI-swimlane bucketing (the "PI-Bahnen" mode of the
 *                       Epic-Breakdown network).
 *
 * Pure: no React, no dagre, no I/O, no Date. The dagre-based layouts stay in
 * their client components (library boundary); only these hand-rolled
 * algorithms are shared.
 */

import {
  NODE_W_COMPACT,
  NODE_W_BREAKDOWN,
} from "@/modules/drumbeat/domain/graph-constants";

// ---------------------------------------------------------------------------
// rankLayout — BFS longest-path rank (compact PI SVG)
// ---------------------------------------------------------------------------

/** Node height / column gap / row gap for the compact SVG rank layout. */
const COMPACT_NODE_H = 44;
const COMPACT_COL_GAP = 80;
const COMPACT_ROW_GAP = 20;

export interface RankNode {
  id: string;
}

export interface RankEdge {
  fromId: string;
  toId: string;
  type: string;
}

export interface RankLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/**
 * Assign each node an (x, y) by longest-path rank: nodes with no incoming
 * directed edge sit at rank 0 (leftmost column); each directed edge pushes its
 * target at least one column right. `relates_to` edges are non-directional and
 * excluded from ranking (their nodes fall back to rank 0 unless a directed edge
 * ranks them). Nodes within a column stack vertically.
 */
export function rankLayout(
  nodes: readonly RankNode[],
  edges: readonly RankEdge[],
): RankLayout {
  if (nodes.length === 0) {
    return { positions: new Map<string, { x: number; y: number }>(), width: 0, height: 0 };
  }

  // BFS rank: sources (no incoming directed edges) get rank 0.
  const directionalEdges = edges.filter((e) => e.type !== "relates_to");
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of directionalEdges) {
    inDegree.set(e.toId, (inDegree.get(e.toId) ?? 0) + 1);
  }

  const rank = new Map<string, number>();
  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  for (const id of queue) rank.set(id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const r = rank.get(current) ?? 0;
    for (const e of directionalEdges.filter((e) => e.fromId === current)) {
      const existing = rank.get(e.toId) ?? 0;
      rank.set(e.toId, Math.max(existing, r + 1));
      if (!queue.includes(e.toId)) queue.push(e.toId);
    }
  }

  // Assign remaining nodes (relates_to only) to rank 0.
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, 0);
  }

  // Group by rank.
  const byRank = new Map<number, RankNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const maxCol = Math.max(...byRank.keys());

  let totalHeight = 0;
  for (const [col, colNodes] of byRank) {
    const colHeight = colNodes.length * (COMPACT_NODE_H + COMPACT_ROW_GAP) - COMPACT_ROW_GAP;
    totalHeight = Math.max(totalHeight, colHeight);
    const x = col * (NODE_W_COMPACT + COMPACT_COL_GAP) + 20;
    colNodes.forEach((n, row) => {
      positions.set(n.id, { x, y: row * (COMPACT_NODE_H + COMPACT_ROW_GAP) + 20 });
    });
  }

  return {
    positions,
    width: (maxCol + 1) * (NODE_W_COMPACT + COMPACT_COL_GAP) + 20,
    height: totalHeight + 40,
  };
}

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
