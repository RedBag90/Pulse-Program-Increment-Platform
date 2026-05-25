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
  | "team"
  | "feature"
  | "epic"
  | "valueStream"
  | "pi"
  | "piStandard"
  | "story"
  | "impediment"
  | "dependency";

const REGISTRY: Record<RevalidationResource, readonly string[]> = {
  art: ["/structure", "/art/[artId]", "/art/[artId]/settings", "/value-streams/[id]"],
  team: [
    "/structure",
    "/art/[artId]/teams",
    "/art/[artId]/settings",
    "/team/[teamId]",
    "/team/[teamId]/settings",
  ],
  feature: [
    "/art/[artId]/features",
    "/portfolio/epics/[id]",
    "/feature/[featureId]",
    "/quality/features",
    "/pi/[piId]",
    "/pi-planning",
  ],
  epic: [
    "/portfolio",
    "/portfolio/epics",
    "/portfolio/epics/[id]",
    "/portfolio/dashboard",
    "/portfolio/budgeting",
  ],
  valueStream: ["/structure", "/value-streams/[id]"],
  pi: ["/structure", "/art/[artId]/pi", "/pi/[piId]", "/pi/[piId]/objectives"],
  piStandard: ["/structure", "/value-streams/[id]"],
  story: ["/feature/[featureId]", "/team/[teamId]"],
  impediment: ["/art/[artId]/impediments"],
  dependency: ["/feature/[featureId]", "/pi/[piId]/dependencies"],
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
