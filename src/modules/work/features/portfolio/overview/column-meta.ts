import type { PortfolioColumn } from "@/modules/work/features/portfolio/lib/epic-lifecycle";

/**
 * Was je **Kanban-Spalte** gilt: ob dort gearbeitet oder gewartet wird, und wie
 * viel Arbeit als zu viel gilt.
 *
 * Hieß bis September 2026 `wip-limits.ts`. Mit dem Rückbau der WIP-Anzeige aus
 * dem Kanban trug der Name nur noch die Hälfte des Inhalts.
 */

/**
 * SAFe-typical soft WIP limits per portfolio Kanban stage. `null` = no limit.
 *
 * **Das Kanban zeigt sie nicht mehr** — die Spaltenköpfe trugen `38 / 5 ⚠` samt
 * bernsteinfarbener Warnung, und die einzige Farbe des Boards war damit ein
 * Alarm. Gelesen werden die Grenzen weiterhin von den Pipeline-Balken und den
 * Top-Risiken, wo sie eine Aussage über den Engpass tragen statt eine Warnung an
 * jeder Spalte.
 */
export const PORTFOLIO_WIP_LIMITS: Record<PortfolioColumn, number | null> = {
  funnel: null, // unlimited intake
  hypothesis: 5,
  business_case: 3,
  investment: 7,
  implementation: 8,
  // „Fertig gebaut, Nutzen noch offen" — hier wartet das Epic auf eine Abnahme,
  // es staut sich nichts. Eine Grenze waere eine Warnung ohne Adressaten.
  impact: null,
};

/** Wird in dieser Spalte am Epic gearbeitet, oder wartet es dort? */
export type ColumnActivity = "work" | "waiting" | "done";

/**
 * **Wo wird gearbeitet, wo liegt das Epic nur?**
 *
 * Abgeleitet aus den Abschnittstexten der Lebenszyklus-Leiter
 * (`features/portfolio/lib/epic-lifecycle.ts`) — die Unterscheidung ist die
 * zwischen „jemand tut etwas am Epic" und „das Epic wartet auf eine fremde
 * Entscheidung":
 *
 *  - **Funnel** — „wartet auf Sichtung"
 *  - **Hypothese** — „Hypothese ausarbeiten"
 *  - **Business Case** — „Lean Business Case erstellen"
 *  - **Investition** — „Die Investitionsentscheidung vorbereiten"
 *  - **Umsetzung** — „Features liefern"
 *  - **Impact** — fertig gemeldet, wartet auf die Nutzen-Abnahme
 */
export const COLUMN_ACTIVITY: Record<PortfolioColumn, ColumnActivity> = {
  funnel: "waiting",
  hypothesis: "work",
  business_case: "work",
  investment: "waiting",
  implementation: "work",
  impact: "done",
};
