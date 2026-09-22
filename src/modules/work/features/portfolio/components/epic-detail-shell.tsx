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
 * **Ein Reiter traegt die Stufe, auf der man in ihm arbeitet — nicht das Tor
 * danach.** Beide Male zeigten die Reiter zuerst auf die Abnahme:
 *
 *  - Die **Hypothese** entsteht auf L0 (`LIFECYCLE_STEPS`: „Hypothese
 *    ausarbeiten", `gate: "L0"`); L1 ist der Meilenstein, der sie freigibt.
 *  - **Business Case, Deliverables, Dependencies und KPI** entstehen auf L1,
 *    nachdem das Vorhaben zur Analyse ausgewaehlt wurde; L2 ist die Freigabe
 *    des Business Case, nicht seine Ausarbeitung.
 *
 * Beschriftet sind damit zwei der acht Stufen (`GATE_STEPS`) — die beiden, auf
 * denen ein Epic tatsaechlich Arbeit traegt. Auf L2, L3, L4.1, L4.2 und L5
 * leuchtet kein Reiter: dort wird abgenommen, Geld zugeteilt oder geliefert,
 * und das geschieht nicht in einem Reiter dieser Seite. Die Etiketten stehen
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
  { key: "benefit-hypothesis", label: "Hypothese", gate: "L0" },
  { key: "business-case", label: "Business Case", gate: "L1" },
  { key: "breakdown", label: "Deliverables", gate: "L1" },
  { key: "dependencies", label: "Dependencies", gate: "L1" },
  { key: "kpis", label: "KPI & Nutzen", gate: "L1" },
  // Bewusst weit hinten (direkt vor History; ein etwaiger Issues-Tab wird in
  // der Page DAVOR injiziert): die Kalkulation ist eine Auswertungs-Sicht.
  { key: "business-case-calc", label: "BC calculation" },
  { key: "history", label: "History" },
];

/** Narrows an arbitrary `?tab=` value to a known Epic tab key, defaulting to Overview. */
export function resolveEpicTab(raw: string | undefined): string {
  return resolveTab(EPIC_TABS, raw);
}
