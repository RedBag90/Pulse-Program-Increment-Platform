/**
 * Shared, render-relevant constants for the Drumbeat dependency graphs.
 *
 * These values used to be copied across three graph components. This is the
 * ONE source. Values are plain data (numbers, hex strings, Tailwind class
 * strings) — no React, no dagre — so the module is safe to import from both
 * client components and pure domain code.
 *
 * Node widths genuinely differ per view (the graphs are laid out at three
 * densities), so they stay as three named exports rather than being forced
 * to one value — the goal is one source, not one value.
 */

import type { DependencyType } from "@/modules/drumbeat/domain/graph-scope";

/** Compact PI dependency SVG (`features/pi/components/dependency-graph.tsx`). */
export const NODE_W_COMPACT = 160;
/** Delivery-Cockpit network (`features/umsetzung/components/cockpit-network.tsx`). */
export const NODE_W_COCKPIT = 200;
/** Epic-Breakdown network (`features/umsetzung/components/breakdown-network-view.tsx`). */
export const NODE_W_BREAKDOWN = 220;

/** Edge stroke color by dependency type. Canonical map shared by all graphs. */
export const EDGE_COLOR: Record<DependencyType, string> = {
  blocks: "#ef4444",
  depends_on: "#d97706",
  relates_to: "#94a3b8",
};

/**
 * Status → dot color (Tailwind class) for the Delivery-Cockpit network, keyed
 * by `FeatureStatus`.
 */
export const STATUS_DOT_COCKPIT: Record<string, string> = {
  approved: "bg-sky-500",
  in_progress: "bg-indigo-500",
  blocked: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

/**
 * Status → dot color (Tailwind class) for the Epic-Breakdown network, keyed by
 * raw initiative status (a wider set than `FeatureStatus`).
 */
export const STATUS_DOT_BREAKDOWN: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-amber-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-500",
  completed: "bg-emerald-500",
};
