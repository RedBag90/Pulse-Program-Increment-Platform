/** German UI labels for initiative state, shared by the Epic and Feature detail pages. */

/**
 * L0–L5 stage-gate labels (Reifegrad — der Investment-Funnel).
 *
 * **Neu geschnitten im September 2026.** Vorher hiess L2 „Business Case" und L3
 * „Investition" mit zwei Unterstufen (L3.1 BC freigegeben, L3.2 Budget
 * alloziert). Jetzt sind das zwei eigene Grade, und „Zur Analyse ausgewählt"
 * ist ein Gate ohne Nummer (`analysis`, siehe `GATE_STEP_KEYS`).
 */
export const STAGE_GATE_KEYS: Record<string, string> = {
  L0: "work.stageGate.l0",
  L1: "work.stageGate.l1",
  L2: "work.stageGate.l2",
  L3: "work.stageGate.l3",
  // L4 traegt als einziges Gate noch zwei Schritte.
  L4: "work.stageGate.l4",
  "L4.2": "work.stageGate.l42",
  L5: "work.stageGate.l5",
};

/** Kurzlabel je Reifegrad-Gate — für kompakte Stepper/Tracks (ohne L-Präfix). */
export const STAGE_SHORT_KEYS: Record<string, string> = {
  L0: "work.stageShort.l0",
  L1: "work.stageShort.l1",
  L2: "work.stageShort.l2",
  L3: "work.stageShort.l3",
  L4: "work.stageShort.l4",
  "L4.2": "work.stageShort.l42",
  L5: "work.stageShort.l5",
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
export const SUB_STAGE_KEYS: Record<string, string> = {
  "L4.1": "work.subStage.l41",
  "L4.2": "work.subStage.l42",
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

/**
 * Lebenszyklus-Status als **Katalog-Schlüssel** (`draft → in_review →
 * approved`, dazu die Lieferzustände). ADR-0024, Regel 2.
 *
 * Hier standen deutsche Wörter, und fünf Flächen lasen sie — auf `/en/` stand
 * damit mitten im Englischen „Freigegeben". Der i18n-Wächter sieht eine
 * Konstanten-Tabelle nicht.
 *
 * **`approved` heisst jetzt „Offen".** Der alte Name stammt aus dem
 * Feature-QS-Freigabelauf, den es seit Juni 2026 nicht mehr gibt (siehe
 * `work.status.approved` im Katalog): ein Feature, das niemand mehr freigibt,
 * ist nicht „freigegeben", es ist offen — geplant und noch nicht begonnen.
 * Der Datenwert bleibt `approved`; nur das Wort ändert sich.
 */
export const STATUS_KEYS: Record<string, string> = {
  draft: "work.status.draft",
  in_review: "work.status.inReview",
  approved: "work.status.approved",
  in_progress: "work.status.inProgress",
  blocked: "work.status.blocked",
  completed: "work.status.completed",
  cancelled: "work.status.cancelled",
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
 * **Audit-Aktion → Beschriftung und Reiter.**
 *
 * Hier standen 31 deutsche Sätze, hartcodiert. Zwei Dinge fehlten ihnen:
 *
 * 1. **Die Sprache.** Eine Konstanten-Tabelle sieht der i18n-Wächter nicht; auf
 *    `/en/` stand die Aktivitäten-Spalte deshalb komplett deutsch da.
 * 2. **Neun Aktionen.** `epic.solutions.set`, die sechs
 *    `initiative.stage_gate.*` und zwei weitere fehlten — für sie griff der
 *    Rückfall `action.replace(/[._]/g, " ")`, und im Feed stand „epic solutions
 *    set".
 *
 * **`group` ist neu und beantwortet die eigentliche Frage.** Der Filter bot
 * bisher „epic" und „initiative" an — die ersten Segmente der Aktionsnamen,
 * roh gerendert. Dasselbe Ding trägt historisch beide Präfixe, die Aufteilung
 * war also nicht bloss unübersetzt, sondern bedeutungslos. Gruppiert wird
 * jetzt nach dem **Reiter**, in dem die Änderung passiert ist.
 *
 * Damit das überhaupt geht, mussten drei Aktionen aufgespalten werden:
 * `saveBenefitHypothesis`, `saveBusinessCase` und `saveTimeline` schrieben
 * alle `initiative.updated` ohne unterscheidbare Nutzlast. Bestandszeilen
 * bleiben unzuordenbar — sie landen sichtbar unter „Frühere Änderungen", statt
 * geraten zu werden.
 */
export interface ActionMeta {
  /** Katalog-Schlüssel der Beschriftung. */
  key: string;
  /** Der Reiter, in dem die Änderung passiert ist — die Gruppe im Feed. */
  group: string;
}

export const ACTION_META: Record<string, ActionMeta> = {
  "initiative.created": { key: "common.activity.action.initiativeCreated", group: "overview" },
  "initiative.updated": { key: "common.activity.action.initiativeUpdated", group: "overview" },
  "initiative.deleted": { key: "common.activity.action.initiativeDeleted", group: "overview" },
  "initiative.stage_gate.advanced": { key: "common.activity.action.gateAdvanced", group: "gate" },
  "initiative.stage_gate.requested": { key: "common.activity.action.gateRequested", group: "gate" },
  "initiative.stage_gate.approval.granted": {
    key: "common.activity.action.gateApprovalGranted",
    group: "gate",
  },
  "initiative.stage_gate.approval.rejected": {
    key: "common.activity.action.gateApprovalRejected",
    group: "gate",
  },
  "initiative.stage_gate.request.rejected": {
    key: "common.activity.action.gateRequestRejected",
    group: "gate",
  },
  "initiative.stage_gate.request.withdrawn": {
    key: "common.activity.action.gateRequestWithdrawn",
    group: "gate",
  },
  "initiative.stage_gate.reverted": { key: "common.activity.action.gateReverted", group: "gate" },
  "wsjf.scored": { key: "common.activity.action.wsjfScored", group: "breakdown" },
  "kpi.created": { key: "common.activity.action.kpiCreated", group: "kpis" },
  "kpi.updated": { key: "common.activity.action.kpiUpdated", group: "kpis" },
  "kpi.deleted": { key: "common.activity.action.kpiDeleted", group: "kpis" },
  "epic.hypothesis.saved": {
    key: "common.activity.action.hypothesisSaved",
    group: "benefit-hypothesis",
  },
  "epic.hypothesis.submitted": {
    key: "common.activity.action.hypothesisSubmitted",
    group: "benefit-hypothesis",
  },
  "epic.hypothesis.approved": {
    key: "common.activity.action.hypothesisApproved",
    group: "benefit-hypothesis",
  },
  "epic.hypothesis.rejected": {
    key: "common.activity.action.hypothesisRejected",
    group: "benefit-hypothesis",
  },
  "epic.approval.configured": { key: "common.activity.action.approvalConfigured", group: "gate" },
  "epic.business_case.saved": {
    key: "common.activity.action.businessCaseSaved",
    group: "business-case",
  },
  "epic.business_case.submitted": {
    key: "common.activity.action.businessCaseSubmitted",
    group: "business-case",
  },
  "epic.business_case.reopened": {
    key: "common.activity.action.businessCaseReopened",
    group: "business-case",
  },
  "epic.timeline.saved": { key: "common.activity.action.timelineSaved", group: "timeline" },
  "epic.approval.granted": { key: "common.activity.action.approvalGranted", group: "gate" },
  "epic.approval.rejected": { key: "common.activity.action.approvalRejected", group: "gate" },
  "epic.section.signed_off": { key: "common.activity.action.sectionSignedOff", group: "gate" },
  "epic.revision.started": {
    key: "common.activity.action.revisionStarted",
    group: "business-case",
  },
  "epic.owner.assigned": { key: "common.activity.action.epicOwnerAssigned", group: "overview" },
  "epic.solutions.set": { key: "common.activity.action.epicSolutionsSet", group: "overview" },
  "epic.portfolio_override.set": {
    key: "common.activity.action.portfolioOverrideSet",
    group: "overview",
  },
  "epic.approved": { key: "common.activity.action.epicApproved", group: "gate" },
  "feature.owner.assigned": {
    key: "common.activity.action.featureOwnerAssigned",
    group: "breakdown",
  },
  "feature.solution.set": { key: "common.activity.action.featureSolutionSet", group: "breakdown" },
  "feature.parent.set": { key: "common.activity.action.featureParentSet", group: "breakdown" },
  "feature.delivery.transitioned": {
    key: "common.activity.action.featureDelivery",
    group: "breakdown",
  },
  "pi.capacity.updated": { key: "common.activity.action.piCapacity", group: "breakdown" },
  "budget_plan.revision.captured": {
    key: "common.activity.action.budgetPlanCaptured",
    group: "overview",
  },
  "timeline.created": { key: "common.activity.action.timelineCreated", group: "timeline" },
  "timeline.updated": { key: "common.activity.action.timelineUpdated", group: "timeline" },
  "timeline.deleted": { key: "common.activity.action.timelineDeleted", group: "timeline" },
  "timeline.art.joined": { key: "common.activity.action.timelineArtJoined", group: "timeline" },
  "timeline.art.left": { key: "common.activity.action.timelineArtLeft", group: "timeline" },
};

/** Die Gruppen in Lesereihenfolge; `other` sammelt, was sich nicht zuordnen lässt. */
export const ACTIVITY_GROUPS = [
  "overview",
  "gate",
  "benefit-hypothesis",
  "business-case",
  "breakdown",
  "kpis",
  "timeline",
  "other",
] as const;

/** An audit action's display label, falling back to a de-dotted form. */
/**
 * Der **Katalog-Schlüssel** einer Aktion — nicht ihr Wort.
 *
 * Hiess bis September 2026 `actionLabel` und gab ein deutsches Wort zurück.
 * Der Name bleibt wichtig: ein `gateLabel`, das einen Schlüssel lieferte, hat
 * in derselben Woche dafür gesorgt, dass auf dem Bildschirm wörtlich
 * „work.gateStep.analysis" stand.
 *
 * Unbekannte Aktionen fallen auf ihren eigenen Namen zurück — sichtbar roh,
 * und das ist richtig: eine erfundene Beschriftung verstünde niemand, der
 * rohe Name lässt sich suchen.
 */
export function actionLabelKey(action: string): string {
  return ACTION_META[action]?.key ?? action.replace(/[._]/g, " ");
}

/** Der Reiter, in dem eine Aktion passiert ist; Unbekanntes sammelt `other`. */
export function actionGroup(action: string): string {
  return ACTION_META[action]?.group ?? "other";
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
export const WSJF_TIER_KEYS: Record<"high" | "medium" | "low" | "none" | "unscored", string> = {
  high: "work.wsjfTier.high",
  medium: "work.wsjfTier.medium",
  low: "work.wsjfTier.low",
  none: "work.wsjfTier.none",
  unscored: "work.wsjfTier.unscored",
};
