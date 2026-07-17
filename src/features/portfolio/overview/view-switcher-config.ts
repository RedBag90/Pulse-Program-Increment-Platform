export type OverviewView = "mission" | "hero" | "executive";

export const OVERVIEW_VIEWS: { key: OverviewView; label: string }[] = [
  { key: "mission", label: "Mission Control" },
  { key: "hero", label: "Hero" },
  { key: "executive", label: "Executive" },
];

/** Defaults to `mission` when the query value is missing or unrecognised. */
export function resolveOverviewView(raw: string | undefined): OverviewView {
  return OVERVIEW_VIEWS.some((v) => v.key === raw) ? (raw as OverviewView) : "mission";
}
