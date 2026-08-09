/**
 * Stable colour palette for the per-Epic stacks on the Portfolio Dashboard.
 * Blue → teal → amber → violet ramp, echoing the reference dashboard. Assigned
 * by position so a given Epic keeps its colour across all panels.
 */
export const EPIC_COLORS = [
  "#1e3a8a", // blue-900
  "#1d4ed8", // blue-700
  "#2563eb", // blue-600
  "#3b82f6", // blue-500
  "#60a5fa", // blue-400
  "#93c5fd", // blue-300
  "#0ea5e9", // sky-500
  "#06b6d4", // cyan-500
  "#14b8a6", // teal-500
  "#eab308", // yellow-500
  "#f59e0b", // amber-500
  "#a78bfa", // violet-400
  "#8b5cf6", // violet-500
  "#7c3aed", // violet-600
  "#c084fc", // purple-400
  "#6366f1", // indigo-500
] as const;

export function epicColor(index: number): string {
  return EPIC_COLORS[index % EPIC_COLORS.length]!;
}

/** Semantic colours shared by the ROI and break-even panels. */
export const VALUE_COLOR = "#16a34a"; // green-600 — business value
export const COST_COLOR = "#dc2626"; // red-600 — cost
export const BREAKEVEN_COLOR = "#6b7280"; // gray-500 — net
