/**
 * View palette for the Drumbeat dependency graphs — edge colors + status-dot
 * Tailwind classes. This is presentation, consumed only by client graph
 * components (Cockpit network, Epic-Breakdown network, edge-type popover), so
 * it lives beside them rather than in `domain/` (which keeps only the node-width
 * geometry that the pure layout math needs).
 */

import type { DependencyType } from "@/modules/drumbeat/domain/graph-scope";

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
