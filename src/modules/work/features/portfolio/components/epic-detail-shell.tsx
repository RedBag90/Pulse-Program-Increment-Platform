import { resolveTab, type DetailTab } from "@/components/detail/entity-detail-shell";

// Re-exported for existing importers; canonical definition is shared across the
// Epic and Feature detail pages.
export { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

/** Tab set of the Epic detail page. Adding a tab = one entry here + one branch in the page. */
export const EPIC_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Reifegrad-Phasen und Timeline" },
  { key: "benefit-hypothesis", label: "Hypothese" },
  { key: "business-case", label: "Business Case" },
  { key: "business-case-calc", label: "Business case calculation" },
  { key: "breakdown", label: "Deliverables" },
  { key: "dependencies", label: "Dependencies" },
  { key: "kpis", label: "KPI & Nutzenkalkulation" },
  { key: "history", label: "History" },
];

/** Narrows an arbitrary `?tab=` value to a known Epic tab key, defaulting to Overview. */
export function resolveEpicTab(raw: string | undefined): string {
  return resolveTab(EPIC_TABS, raw);
}
