/**
 * ROAM — the SAFe risk-disposition primitive (Resolved / Owned / Accepted /
 * Mitigated), plus the pre-ROAM `open` (identified, un-ROAMed) state. Lives in
 * Core so every consumer imports it downward: the Drumbeat Impediment (which
 * carries a `roamStatus`) and the Risks module both share this one vocabulary
 * and colour palette — no per-module re-definitions (ADR-0013).
 */

export type RoamStatus = "open" | "resolved" | "owned" | "accepted" | "mitigated";

export const ROAM_STATUSES: readonly RoamStatus[] = [
  "open",
  "resolved",
  "owned",
  "accepted",
  "mitigated",
];

export function isRoamStatus(s: string): s is RoamStatus {
  return (ROAM_STATUSES as readonly string[]).includes(s);
}

/** Display labels (de/EN mix as used across the app). */
export const ROAM_LABELS: Record<RoamStatus, string> = {
  open: "Offen",
  resolved: "Resolved",
  owned: "Owned",
  accepted: "Accepted",
  mitigated: "Mitigated",
};

/**
 * Canonical ROAM-cluster palette — one hue per disposition, shared by every
 * surface (impediment overview, ROAM board, risk-matrix dots, list chips).
 * `ROAM_DOT` = Tailwind background class; `ROAM_HEX` = raw hex for SVG/Canvas
 * (the risk matrix draws dots + connectors on Canvas).
 */
export const ROAM_DOT: Record<RoamStatus, string> = {
  open: "bg-amber-500",
  resolved: "bg-emerald-500",
  owned: "bg-blue-500",
  accepted: "bg-slate-500",
  mitigated: "bg-purple-500",
};

export const ROAM_HEX: Record<RoamStatus, string> = {
  open: "#f59e0b",
  resolved: "#10b981",
  owned: "#3b82f6",
  accepted: "#64748b",
  mitigated: "#a855f7",
};
