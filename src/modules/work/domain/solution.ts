/**
 * SAFe Solution — Domänen-Konstanten & reine Helfer. Die Solution ist das
 * langlebige Produkt/System zwischen Value Stream und Epic; ihr Horizont
 * (h3 R&D → h2 Emerging → h1 Investing/Extracting → h0 Decommissioning) wird an
 * die zugeordneten Epics vererbt (Primär-Solution). Persistenz + Validierung der
 * Kanten liegen im Service; hier nur die klassifikatorischen Bausteine.
 */

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";
import { type Horizon } from "@/modules/work/domain/portfolio-guardrails";

/** Untermodus in H1: aktiv ausbauen vs. effizient „melken". Nur in H1 gesetzt. */
export const INVESTMENT_MODES = ["investing", "extracting"] as const;
export type InvestmentMode = (typeof INVESTMENT_MODES)[number];
export const isInvestmentMode = makeTypeGuard(INVESTMENT_MODES);

export const INVESTMENT_MODE_LABEL: Record<InvestmentMode, string> = {
  investing: "Investing",
  extracting: "Extracting",
};

/**
 * Der wählbare Solution-**Status** — fünf Werte, die H1 in Investing/Extracting
 * aufspalten. Abgeleitet aus `(horizon, investmentMode)`; kein eigenes DB-Feld.
 * Guardrail + Kanban bucketen weiter nach dem 4-wertigen `horizon` (Investing &
 * Extracting fallen beide in H1).
 */
export const SOLUTION_STATUSES = [
  "rd",
  "emerging",
  "investing",
  "extracting",
  "decommissioning",
] as const;
export type SolutionStatus = (typeof SOLUTION_STATUSES)[number];
export const isSolutionStatus = makeTypeGuard(SOLUTION_STATUSES);

export const SOLUTION_STATUS_LABEL: Record<SolutionStatus, string> = {
  rd: "R&D",
  emerging: "Emerging",
  investing: "Investing",
  extracting: "Extracting",
  decommissioning: "Decommissioning",
};

/** Leitet den Status aus Horizont + Modus ab. */
export function solutionStatusOf(horizon: Horizon, mode: InvestmentMode | null): SolutionStatus {
  switch (horizon) {
    case "h3":
      return "rd";
    case "h2":
      return "emerging";
    case "h1":
      return mode === "extracting" ? "extracting" : "investing";
    case "h0":
      return "decommissioning";
  }
}

/** Umkehrung: Status → (Horizont, Modus). Modus nur bei extracting/investing (H1). */
export function solutionStatusToHorizonMode(status: SolutionStatus): {
  horizon: Horizon;
  investmentMode: InvestmentMode | null;
} {
  switch (status) {
    case "rd":
      return { horizon: "h3", investmentMode: null };
    case "emerging":
      return { horizon: "h2", investmentMode: null };
    case "investing":
      return { horizon: "h1", investmentMode: "investing" };
    case "extracting":
      return { horizon: "h1", investmentMode: "extracting" };
    case "decommissioning":
      return { horizon: "h0", investmentMode: null };
  }
}

/**
 * Die vier Kriterien des Transition-Gates H2→H1 („befördern"). Alle müssen
 * bestätigt sein, bevor eine Emerging-Solution zur Kern-Solution wird.
 */
export const PROMOTION_CRITERIA = [
  { key: "benefitValidated", label: "Benefit-Hypothese durch Marktdaten validiert" },
  { key: "runStable", label: "Run-Baseline stabil / prognostizierbar" },
  { key: "valueStreamAligned", label: "Ziel-Value-Stream & ART zugewiesen" },
  { key: "viable", label: "Wirtschaftlich tragfähig (LTV / CAC)" },
] as const;
export type PromotionCriterionKey = (typeof PROMOTION_CRITERIA)[number]["key"];

/**
 * Normalisiert den Invest/Extract-Modus zum Horizont: außerhalb H1 ist er
 * bedeutungslos und wird auf `null` gesetzt.
 */
export function investmentModeForHorizon(
  horizon: Horizon,
  mode: InvestmentMode | null,
): InvestmentMode | null {
  return horizon === "h1" ? mode : null;
}

/**
 * Die Leiter als **Stufen-Beschriftung** — fünf Stationen, nicht vier.
 *
 * H1 trägt zwei wirtschaftlich verschiedene Phasen: ausbauen und ernten. Bis
 * September 2026 zeigte die Lebenszyklus-Leiste sie nicht als Schritte, sondern
 * als Schieber am rechten Rand: vier Stufen oben, ein Umschalter unten. Der
 * Wechsel von „wir bauen aus" zu „wir melken" war damit optisch kein Schritt auf
 * der Leiter, obwohl er einer ist.
 *
 * Die Nummerierung folgt dem Reifegrad-Vorbild, wo `L3` ebenso in `L3.1`/`L3.2`
 * zerfällt: **die Achse bleibt vierwertig, die Leiter zeigt fünf Stufen.**
 */
export const SOLUTION_STATUS_STEP_LABEL: Record<SolutionStatus, string> = {
  rd: "H3 · R&D",
  emerging: "H2 · Emerging",
  investing: "H1.1 · Investing",
  extracting: "H1.2 · Extracting",
  decommissioning: "H0 · Decommissioning",
};

export interface SolutionTransition {
  to: SolutionStatus;
  label: string;
  /**
   * Das Beförderungs-Tor. Genau **eine** Kante trägt es: der Eintritt in den
   * Kern (H2 → H1.1), an dem `PROMOTION_CRITERIA` bestätigt werden müssen.
   * Ohne diese Zusicherung umginge die Leiste das Tor, das sie selbst zeichnet.
   */
  gate?: boolean;
}

/**
 * Die erlaubten Kanten je Stufe — vorwärts, rückwärts und aus dem Auslauf zurück.
 *
 * H1.1 → H1.2 ist ein Schritt wie jeder andere: ein Klick, keine Rückfrage. Der
 * Rückweg bleibt offen, denn ein Produkt kann wieder Investitionen bekommen.
 *
 * Rein, kein I/O — deshalb prüfbar. Vorher stand dieselbe Liste als
 * Objektliteral in der Komponente und war es nicht.
 */
export const SOLUTION_TRANSITIONS: Record<SolutionStatus, readonly SolutionTransition[]> = {
  rd: [{ to: "emerging", label: "Nach H2 (Emerging)" }],
  emerging: [
    { to: "investing", label: "Nach H1 befördern", gate: true },
    { to: "rd", label: "Zurück zu H3" },
  ],
  investing: [
    { to: "extracting", label: "Auf Ernten umstellen (H1.2)" },
    { to: "decommissioning", label: "Stilllegen (H0)" },
    { to: "emerging", label: "Zurück zu H2" },
  ],
  extracting: [
    { to: "investing", label: "Wieder investieren (H1.1)" },
    { to: "decommissioning", label: "Stilllegen (H0)" },
    { to: "emerging", label: "Zurück zu H2" },
  ],
  decommissioning: [{ to: "investing", label: "Reaktivieren (H1.1)" }],
};
