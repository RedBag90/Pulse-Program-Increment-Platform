/** German UI labels for initiative state, shared by the Epic and Feature detail pages. */

/**
 * L0–L5 stage-gate labels (Reifegrad — der Investment-Funnel).
 *
 * **Neu geschnitten im September 2026.** Vorher hiess L2 „Business Case" und L3
 * „Investition" mit zwei Unterstufen (L3.1 BC freigegeben, L3.2 Budget
 * alloziert). Jetzt sind das zwei eigene Grade, und „Zur Analyse ausgewählt"
 * ist ein Gate ohne Nummer (`analysis`, siehe `GATE_STEP_LABELS`).
 */
export const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Idee",
  L1: "L1 Hypothese freigegeben",
  L2: "L2 Business Case freigegeben",
  L3: "L3 Budget alloziert",
  // L4 traegt als einziges Gate noch zwei Schritte.
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
 * Sub-Step-Labels innerhalb des Major-Gates L4 — dem einzigen, das seit dem
 * Neuschnitt noch zwei Schritte traegt. Die Eintritts-Stufe (L4.1) wird
 * abgeleitet, die zweite (L4.2) kommt aus einer abgenommenen Bestaetigung.
 */
export const SUB_STAGE_LABELS: Record<string, string> = {
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
  "feature.solution.set": "Solution am Feature gesetzt",
  "feature.parent.set": "Epic-Zuordnung geändert",
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

/**
 * Farb-Token je WSJF-Rang.
 *
 * Lag zweimal kopiert in den Aufrufern — `feature-list-row` (work) und
 * `feature-overview-tab` (drumbeat) — beide ohne `dark:`-Partner, mit leicht
 * verschiedenen Werten. Hier, in der geteilten Schicht, kann **beide** Seiten
 * lesen, ohne die Modulgrenze aus ADR-0013 zu verletzen.
 *
 * Der Schlüssel deckt beide Namen für „kein Rang" ab: `none` (Listenzeile) und
 * `unscored` (Detailansicht). Die rohe Palette trägt hier vollständige
 * `dark:`-Paare und eine Achse — der von ADR-0021 ausdrücklich erlaubte Fall.
 */
export const WSJF_TIER_CLASS: Record<"high" | "medium" | "low" | "none" | "unscored", string> = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground/70",
  unscored: "bg-muted text-muted-foreground",
};

/**
 * Die **Wörter** zum WSJF-Rang — Gegenstück zu {@link WSJF_TIER_CLASS}, und
 * aus demselben Grund hier.
 *
 * Bis September 2026 gab es sie dreimal, in drei verschiedenen Registern: die
 * Epics-nahe Feature-Tabelle schrieb „Hoch/Mittel/Niedrig/Ungescored", die
 * Listenzeile daneben **englisch** „High/Med/Low" — zwei Flächen desselben
 * Moduls, die denselben Rang verschieden benannten —, und die Detailansicht im
 * Drumbeat „WSJF hoch". Die dritte bleibt vorerst stehen: sie setzt das Wort
 * „WSJF" in die Pille und beschriftet den Rang deshalb klein.
 *
 * Der Schlüssel deckt wie oben beide Namen für „kein Rang" ab.
 */
export const WSJF_TIER_LABELS: Record<"high" | "medium" | "low" | "none" | "unscored", string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  none: "Ungescored",
  unscored: "Ungescored",
};
