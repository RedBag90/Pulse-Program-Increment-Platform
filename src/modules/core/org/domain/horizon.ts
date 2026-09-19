/**
 * **Der Investitionshorizont** — H3 bis H0 nach dem McKinsey-Drei-Horizonte-
 * Modell, um eine vierte Stufe (Decommissioning) erweitert.
 *
 * Er steht in **Core**, weil ihn die `Solution` traegt: ein langlebiges Produkt
 * ist eine Wette auf eine Zeitlage, und das ist eine Eigenschaft des
 * Strukturknotens, nicht der Arbeit an ihm. Dass auch Epics und die
 * Portfolio-Guardrails mit ihm rechnen, macht ihn nicht zu Work — ein Typ
 * gehoert auf die **unterste** Schicht, die ihn braucht (ADR-0013).
 *
 * Vorher lag er in `work/domain/portfolio-guardrails.ts`, zusammen mit den
 * Stationen und den Guardrail-Zielen. Die bleiben dort: sie sind Portfolio-
 * Steuerung. Nur der Horizont selbst sinkt ab.
 */

import { makeTypeGuard } from "@/modules/core/kernel/domain/type-guards";

// Vier Investitionshorizonte (Lebenszyklus der Solution), in Anzeige-/Sortier-
// Reihenfolge: R&D oben → End-of-Life unten.
export const HORIZONS = ["h3", "h2", "h1", "h0"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const isHorizon = makeTypeGuard(HORIZONS);

export const HORIZON_LABEL: Record<Horizon, string> = {
  h3: "H3 · R&D",
  h2: "H2 · Emerging",
  h1: "H1 · Investing",
  h0: "H0 · Decommissioning",
};

/**
 * **Die Beschriftung einer Solution-Zeile** — der Horizont, und in H1 der
 * Investitionsmodus.
 *
 * Der Sonderfall ist keine Spitzfindigkeit: H1 zerfällt wirtschaftlich in
 * *Investing* („wir bauen aus") und *Extracting* („wir ernten"), und beide
 * tragen denselben Horizont `h1`. Wer nur `HORIZON_LABEL` liest, nennt eine
 * Extracting-Solution „Investing" — genau das tat der Organisations-Baum bis
 * September 2026 mit einer eigenen Etikettenliste `HORIZON_SHORT`, während die
 * Solutions-Liste daneben korrekt zwei Zustände zeigte.
 *
 * Deshalb steht die Regel **einmal** hier: der Baum liest sie, das
 * Horizont-Abzeichen liest sie. Eine zweite Liste gibt es nicht mehr.
 *
 * `mode` ist bewusst lose typisiert — die Leser reichen die Spalte durch, wie
 * sie aus der Datenbank kommt.
 */
export function horizonLabel(horizon: Horizon, mode: string | null | undefined): string {
  return horizon === "h1" && mode === "extracting" ? "H1 · Extracting" : HORIZON_LABEL[horizon];
}

/** Erklärtexte je Horizont — Quelle für Tooltips + Legende (Helfer-Schicht). */
export const HORIZON_HELP: Record<
  Horizon,
  { blurb: string; epicArt: string; budgetFokus: string }
> = {
  h3: {
    blurb: "Evaluating / R&D — noch keine Solution, nur Ideen, Spikes und Prototypen.",
    epicArt: "Exploratory Epics (Machbarkeit, Prototypen, Patente)",
    budgetFokus: "Lernen & Validieren (reine OpEx)",
  },
  h2: {
    blurb: "Emerging — eine neue Solution entsteht und wird als MVP am Markt getestet.",
    epicArt: "Emerging Epics (MVP-Bau, Markttest)",
    budgetFokus: "Markttest & Skalierung (fast nur Grow)",
  },
  h1: {
    blurb: "Investing & Extracting — etablierte Kern-Solution, trägt den Hauptumsatz.",
    epicArt: "Business Epics (Erweiterung) + Enabler Epics (Umbau)",
    budgetFokus: "Ausbauen (Invest) bzw. effizient betreiben (Extract)",
  },
  h0: {
    blurb: "Decommissioning — Solution am Lebensende, wird geordnet abgeschaltet.",
    epicArt: "Decommissioning Epics (Migration, Archivierung, Shutdown)",
    budgetFokus: "Run-Budget auf 0 senken (OpEx-Abwicklung)",
  },
};

/** Kurze Konzept-Erklärungen für die Onboarding-Helfer. */
export const CONCEPT_HELP = {
  solutionVsEpic:
    "Eine Solution ist das langlebige Produkt/System (erzeugt laufende Betriebskosten, Run). Ein Epic ist eine große, zeitlich begrenzte Veränderung an einer Solution (Grow). Die Primär-Solution bestimmt den Investitionshorizont des Epics — außer in H3: dort gibt es keine Solution, und das Vorhaben trägt seinen Horizont selbst.",
  grow: "Grow = Σ Umsetzungskosten der laufenden Epics dieser Solution (Investition in Weiterentwicklung).",
  run: "Run = Σ der Run-the-Business-Positionen, die dieser Solution zugerechnet sind, auf ein Jahr gerechnet (Wartung, Support, Infrastruktur). Gepflegt werden sie im Budgeting-Modul — je Position mit eigener Periode; wertstrom-übergreifende Positionen zählen in keine Solution.",
  primarySolution:
    "Die Primär-Solution eines Epics liefert seinen Investitionshorizont und seine Swimlane im Portfolio-Kanban — solange am Epic selbst keiner steht. Ein R&D-Vorhaben hat gar keine Solution und trägt ihn deshalb immer selbst.",
} as const;
