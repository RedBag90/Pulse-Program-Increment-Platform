import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Revalidation registry
//
// Maps a mutated *domain resource* to the set of Next.js routes that display
// it. Actions declare what they changed (`revalidate: "art"`) instead of
// hardcoding paths in each `onSuccess`; "which pages show ARTs?" is answered
// here, once, rather than smeared across every ART/Team/Feature action.
//
// Paths use the App Router template form (`/art/[artId]/settings`) revalidated
// with the `"page"` type, which refreshes *all* instances of that dynamic
// route — no per-call ids to thread. Static routes are revalidated as-is.
// The set per resource is a deliberate superset: over-revalidation is cheap and
// removes the per-action drift that the structure-hub consolidation suffered.
// ---------------------------------------------------------------------------

export type RevalidationResource =
  | "art"
  | "artCreated"
  | "feature"
  | "epic"
  | "valueStream"
  | "budgetAllocation"
  | "budgetRound"
  | "pi"
  | "piStandard"
  | "budgetPlanRevision"
  | "timeline"
  | "story"
  | "dependency"
  | "ziele"
  | "goalCustomFields"
  | "setup"
  | "risk"
  | "portfolioFilter"
  | "roleOnboarding";

const REGISTRY: Record<RevalidationResource, readonly string[]> = {
  art: ["/structure", "/art/[artId]", "/art/[artId]/settings", "/value-streams/[id]"],
  // Beim CREATE reicht der schmale Cut: die neue Detail-Page wird ohnehin
  // bei der Navigation frisch gerendert; nur die Aggregations-Listen
  // muessen den neuen Eintrag sehen.
  artCreated: ["/structure", "/value-streams/[id]"],
  feature: [
    "/art/[artId]/features",
    "/portfolio/epics/[id]",
    "/feature/[featureId]",
    "/pi/[piId]",
    "/pi-planning",
    // Die Cockpit-Vollroute und die persönliche Inbox fehlten hier: ein
    // Owner-Wechsel blieb dort sichtbar veraltet, obwohl er gespeichert war.
    "/umsetzung/feature/[id]",
    "/my-tasks",
  ],
  epic: [
    "/portfolio",
    "/portfolio/epics",
    "/portfolio/epics/[id]",
    "/portfolio/dashboard",
    "/budgeting/board",
  ],
  valueStream: ["/structure", "/value-streams/[id]"],
  // Eine Epic-Zuteilung (oder der Topf) aendert das ABGELEITETE Wertstrom-Budget
  // — und das zeigen weit mehr Seiten als das Board selbst. Vorher deklarierten
  // beide Aktionen `epic`, wodurch Struktur-, Timeline- und Reporting-Sichten
  // nach dem Speichern veraltete Summen zeigten.
  budgetAllocation: [
    "/budgeting",
    "/budgeting/board",
    "/portfolio",
    "/portfolio/epics/[id]",
    "/structure",
    "/timelines",
    "/value-streams/[id]",
    "/reporting/portfolio-health",
  ],
  pi: ["/umsetzung", "/structure", "/art/[artId]/pi", "/pi/[piId]", "/pi-planning"],
  piStandard: ["/structure", "/value-streams/[id]"],
  budgetPlanRevision: ["/budgeting", "/budgeting/budget-plan", "/budgeting/budget-plan/[id]"],
  budgetRound: ["/budgeting", "/budgeting/rounds", "/budgeting/rounds/[id]"],
  // Timeline mutations ripple anywhere PIs surface (planning, PI detail) and
  // the structure tab that hosts the management UI.
  timeline: ["/umsetzung", "/structure", "/pi-planning", "/pi/[piId]", "/art/[artId]/pi", "/feature/[featureId]"],
  story: ["/feature/[featureId]"],
  dependency: ["/umsetzung", "/feature/[featureId]"],
  ziele: ["/ziele"],
  // Feld-Defs wirken auf die Admin-Seite UND auf jeden Ziel-Drawer.
  goalCustomFields: ["/admin/goal-fields", "/ziele"],
  setup: ["/setup"],
  // `risk`-Actions decken das Issue-Register, den Epic-Issues-Tab und die
  // Portfolio-Übersicht (Risiken-Kachel).
  risk: ["/issues", "/portfolio/epics/[id]", "/portfolio"],
  portfolioFilter: ["/portfolio"],
  // Nur die Nachschlage-Seite. Das Willkommensfenster selbst hängt am
  // Dashboard-Layout und wird nach dem Annehmen clientseitig geschlossen —
  // ein globales Layout-Revalidate für jede Quittung wäre unverhältnismäßig.
  roleOnboarding: ["/meine-rolle"],
};

/** Revalidates every route registered for the given resource. */
export function revalidateFor(resource: RevalidationResource): void {
  for (const path of REGISTRY[resource]) {
    // Dynamic-segment templates need the "page" type to revalidate all matches;
    // static routes are revalidated directly.
    if (path.includes("[")) revalidatePath(path, "page");
    else revalidatePath(path);
  }
}
