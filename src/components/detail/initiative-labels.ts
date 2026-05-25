/** German UI labels for initiative state, shared by the Epic and Feature detail pages. */

/** L0–L5 stage-gate labels (the investment funnel). */
export const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Funnel",
  L1: "L1 Hypothesis stage",
  L2: "L2 Analyzing",
  L3: "L3 Portfolio Backlog",
  L4: "L4 Implementing",
  L5: "L5 Done",
};

/** Status indicator dot colors (Tailwind) — shared by the Kanban board and the Epics table. */
export const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-blue-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/20",
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

/**
 * The Epic's primary lifecycle — the multi-party approval workflow phase. This is
 * the one status surfaced prominently on the Epic; the stage gate is contextual
 * and the QS `status` is not shown as a competing status.
 */
export const APPROVAL_PHASE_LABELS: Record<string, string> = {
  draft: "Entwurf",
  hypothesis_review: "Hypothese in QS (VMO)",
  business_case: "Business Case",
  stakeholder_review: "Stakeholder-Freigaben",
  approved: "Freigegeben",
};

/** Pastel pill colours per approval phase (Tailwind classes). */
export const APPROVAL_PHASE_BADGE: Record<string, string> = {
  draft: "bg-muted text-foreground/80",
  hypothesis_review: "bg-amber-100 text-amber-800",
  business_case: "bg-blue-100 text-blue-800",
  stakeholder_review: "bg-indigo-100 text-indigo-800",
  approved: "bg-emerald-100 text-emerald-800",
};

/**
 * Friendly German labels for audit actions — shared by the Activity sidebar and
 * the History tab so both read the same. Unknown actions degrade gracefully via
 * {@link actionLabel}.
 */
export const ACTION_LABELS: Record<string, string> = {
  "initiative.created": "Initiative erstellt",
  "initiative.updated": "Initiative aktualisiert",
  "initiative.deleted": "Initiative gelöscht",
  "initiative.stage_gate.advanced": "Stage Gate geändert",
  "wsjf.scored": "WSJF bewertet",
  "kpi.created": "KPI erstellt",
  "kpi.updated": "KPI aktualisiert",
  "kpi.deleted": "KPI gelöscht",
  // Epic multi-party approval workflow
  "epic.hypothesis.submitted": "Hypothese zur QS eingereicht",
  "epic.hypothesis.approved": "Hypothese freigegeben",
  "epic.hypothesis.rejected": "Hypothese zurückgegeben",
  "epic.approval.configured": "Approver konfiguriert",
  "epic.business_case.submitted": "Business Case zur Freigabe eingereicht",
  "epic.business_case.reopened": "Business Case zur Überarbeitung geöffnet",
  "epic.approval.granted": "Freigabe erteilt",
  "epic.approval.rejected": "Freigabe abgelehnt",
  "epic.section.signed_off": "Abschnitt abgenommen",
  "epic.revision.started": "Neue Revision gestartet",
  "epic.owner.assigned": "Epic Owner zugewiesen",
};

/** An audit action's display label, falling back to a de-dotted form. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/** A short, stable fallback when a user id can't be resolved to a name. */
export function shortUserId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/**
 * Up-to-two-character initials for an avatar fallback. Works for emails
 * (`anna.k@x.dev` → "AK"), names (`Anna Klein` → "AK"), and short ids.
 */
export function initials(label: string): string {
  const local = label.includes("@") ? (label.split("@")[0] ?? label) : label;
  const parts = local.split(/[.\s_-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : local.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Resolves a user id to its display label (email) from a resolved map, falling
 * back to a short id when unknown. Pure — safe in client components.
 */
export function userLabel(id: string | null | undefined, labels: Record<string, string>): string {
  if (!id) return "—";
  return labels[id] ?? shortUserId(id);
}
