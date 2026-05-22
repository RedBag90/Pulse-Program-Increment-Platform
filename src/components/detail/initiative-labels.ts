/** German UI labels for initiative state, shared by the Epic and Feature detail pages. */

/** L0–L5 stage-gate labels (the investment funnel). */
export const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Funnel",
  L1: "L1 Reviewing",
  L2: "L2 Analyzing",
  L3: "L3 Portfolio Backlog",
  L4: "L4 Implementing",
  L5: "L5 Done",
};

/** QS / lifecycle status labels (`draft → in_review → approved`, plus delivery states). */
export const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  in_review: "In Prüfung",
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  blocked: "Blockiert",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};
