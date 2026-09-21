import { resolveTab, type DetailTab } from "@/components/detail/entity-detail-shell";

// Re-exported for existing importers; canonical definition is shared across the
// Epic and Feature detail pages.
export { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

/**
 * Tab set of the Epic detail page. Adding a tab = one entry here + one branch in the page.
 *
 * **`gate` betitelt den Reiter mit seinem Reifegrad** und laesst ihn aufleuchten,
 * sobald das Epic dort steht. Die Zuordnung ist eine **Festlegung**, keine
 * Ableitung: sie sagt, woran auf dieser Stufe gearbeitet wird, und das ist eine
 * Entscheidung ueber den Prozess.
 *
 * Beschriftet sind heute zwei der acht Stufen (`GATE_STEPS`). Auf L0, L3.1,
 * L3.2, L4.1, L4.2 und L5 leuchtet darum kein Reiter — die Etiketten stehen
 * trotzdem da. Wer das ergaenzen will, setzt ein `gate` mehr; die Schiene
 * braucht dafuer keine Aenderung.
 *
 * Reiter **ohne** `gate` gehoeren zu keinem Schritt: Overview und
 * Reifegrad-Timeline gelten durchgehend, BC calculation und History sind
 * Auswertungen.
 */
export const EPIC_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Reifegrad-Timeline" },
  { key: "benefit-hypothesis", label: "Hypothese", gate: "L1" },
  { key: "business-case", label: "Business Case", gate: "L2" },
  { key: "breakdown", label: "Deliverables", gate: "L2" },
  { key: "dependencies", label: "Dependencies", gate: "L2" },
  { key: "kpis", label: "KPI & Nutzen", gate: "L2" },
  // Bewusst weit hinten (direkt vor History; ein etwaiger Issues-Tab wird in
  // der Page DAVOR injiziert): die Kalkulation ist eine Auswertungs-Sicht.
  { key: "business-case-calc", label: "BC calculation" },
  { key: "history", label: "History" },
];

/** Narrows an arbitrary `?tab=` value to a known Epic tab key, defaulting to Overview. */
export function resolveEpicTab(raw: string | undefined): string {
  return resolveTab(EPIC_TABS, raw);
}
