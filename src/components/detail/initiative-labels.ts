/** German UI labels for initiative state, shared by the Epic and Feature detail pages. */

/**
 * L0–L5 stage-gate labels (Reifegrad — der Investment-Funnel).
 * Modell v2 (siehe Plan vom 2026-06-07): Major-Gates bleiben L0..L5, die
 * Semantik orientiert sich jetzt am Reifegrad statt am Workflow.
 */
export const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Idee",
  L1: "L1 Hypothese definiert",
  L2: "L2 Business Case",
  // L3 traegt zwei Schritte: Eintritt (BC freigegeben) und die
  // Investitionsentscheidung selbst.
  L3: "L3 Investition",
  // Beide L3-Schritte werden beantragt und abgenommen, ebenso L4.2.
  "L3.1": "L3.1 BC freigegeben",
  "L3.2": "L3.2 Budget alloziert",
  L4: "L4 Implementierung",
  "L4.2": "L4.2 Umsetzung fertig",
  L5: "L5 Impact realisiert",
};

/** Kurzlabel je Reifegrad-Gate — für kompakte Stepper/Tracks (ohne L-Präfix). */
export const STAGE_SHORT: Record<string, string> = {
  L0: "Funnel",
  L1: "Hypothese",
  L2: "Business Case",
  L3: "Investition",
  "L3.1": "BC freigegeben",
  "L3.2": "Budget alloziert",
  L4: "Umsetzung",
  "L4.2": "Umsetzung fertig",
  L5: "Impact",
};

/**
 * Reifegrad-Punktfarbe (Tailwind) je Gate — **eine** Quelle für Reifegrad-Bar,
 * Epics-Tabelle und Stepper (vorher dreifach dupliziert).
 */
export const STAGE_DOT: Record<string, string> = {
  L0: "bg-muted-foreground/40",
  L1: "bg-amber-400",
  L2: "bg-blue-400",
  L3: "bg-indigo-400",
  L4: "bg-primary",
  "L4.2": "bg-primary",
  L5: "bg-emerald-500",
};

/**
 * Sub-Step-Labels innerhalb der Major-Gates L3 und L4. Die Eintritts-Stufen
 * (L3.1, L4.1) werden abgeleitet, die zweiten (L3.2, L4.2) kommen aus einer
 * abgenommenen Bestaetigung — beide werden nur in der UI gerendert.
 */
export const SUB_STAGE_LABELS: Record<string, string> = {
  "L3.1": "BC freigegeben",
  "L3.2": "Budget alloziert",
  "L4.1": "Umsetzung läuft",
  "L4.2": "Umsetzung fertig",
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
 * Semantische Status-Chips (Tailwind, dark-safe) für QS-/Delivery-Status —
 * eine Quelle für Feature-Rows u. Ä. statt monochromem `bg-muted`.
 */
export const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  in_progress: "bg-primary/10 text-primary",
  blocked: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground/70 line-through",
};

/**
 * Friendly German labels for audit actions — shared by the Activity sidebar and
 * the History tab so both read the same. Unknown actions degrade gracefully via
 * {@link actionLabel}.
 */
const ACTION_LABELS: Record<string, string> = {
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
  "feature.owner.assigned": "Feature-Owner zugewiesen",
  "pi.capacity.updated": "PI-Kapazität gesetzt",
  "feature.delivery.transitioned": "Feature-Status geändert",
  "budget_plan.revision.captured": "Budget-Plan-Revision erfasst",
  "timeline.created": "Timeline erstellt",
  "timeline.updated": "Timeline geändert",
  "timeline.deleted": "Timeline gelöscht",
  "timeline.art.joined": "ART einer Timeline zugeordnet",
  "timeline.art.left": "ART aus einer Timeline gelöst",
};

/** An audit action's display label, falling back to a de-dotted form. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
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
  return labels[id] ?? `${id.slice(0, 8)}…`;
}
