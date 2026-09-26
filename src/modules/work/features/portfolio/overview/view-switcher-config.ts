/**
 * **Die Ansichten der Portfolio-Übersicht** — „Gesamt" und je eine für die drei
 * Portfolio-Termine (Wiki: „Welche Termine es braucht").
 *
 * Bis September 2026 standen hier drei Layout-Varianten zum Vergleichen
 * (Mission Control, Hero, Executive). Hero und Executive sind in den
 * Meeting-Ansichten aufgegangen; ein alter Link mit `?view=hero|executive`
 * landet auf „Gesamt".
 */
export type OverviewView = "mission" | "review" | "sync" | "budgeting";

export const OVERVIEW_VIEWS: { key: OverviewView; labelKey: string }[] = [
  { key: "mission", labelKey: "work.overview.viewGesamt" },
  { key: "review", labelKey: "work.overview.viewReview" },
  { key: "sync", labelKey: "work.overview.viewSync" },
  { key: "budgeting", labelKey: "work.overview.viewBudgeting" },
];

/**
 * Die Ansicht aus der URL; `mission`, wenn der Wert fehlt, unbekannt ist oder
 * nicht verfügbar — die Budgeting-Ansicht gibt es nur mit dem Modul.
 */
export function resolveOverviewView(
  raw: string | undefined,
  available: readonly OverviewView[] = OVERVIEW_VIEWS.map((v) => v.key),
): OverviewView {
  return available.includes(raw as OverviewView) ? (raw as OverviewView) : "mission";
}

/** Welche Ansichten es gibt: Budgeting nur mit dem Budgeting-Modul. */
export function availableOverviewViews(budgetingEnabled: boolean): OverviewView[] {
  return OVERVIEW_VIEWS.map((v) => v.key).filter((k) => k !== "budgeting" || budgetingEnabled);
}
