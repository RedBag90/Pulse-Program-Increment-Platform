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

export const HORIZON_KEYS: Record<Horizon, string> = {
  h3: "org.horizon.h3",
  h2: "org.horizon.h2",
  h1: "org.horizon.h1",
  h0: "org.horizon.h0",
};

/**
 * **Die Beschriftung einer Solution-Zeile** — der Horizont, und in H1 der
 * Investitionsmodus.
 *
 * Der Sonderfall ist keine Spitzfindigkeit: H1 zerfällt wirtschaftlich in
 * *Investing* („wir bauen aus") und *Extracting* („wir ernten"), und beide
 * tragen denselben Horizont `h1`. Wer nur `HORIZON_KEYS` liest, nennt eine
 * Extracting-Solution „Investing" — genau das tat der Organisations-Baum bis
 * September 2026 mit einer eigenen Etikettenliste `HORIZON_SHORT`, während die
 * Solutions-Liste daneben korrekt zwei Zustände zeigte.
 *
 * Deshalb steht die Regel **einmal** hier: der Baum liest sie, das
 * Horizont-Abzeichen liest sie. Eine zweite Liste gibt es nicht mehr.
 *
 * **Sie hiess bis September 2026 `horizonLabel` und gab links ein Wort, rechts
 * einen Schlüssel zurück** — beides `string`, der Compiler blind. Das Abzeichen
 * rendert die Rückgabe roh: auf dem Bildschirm stand `org.horizon.h2`. Und
 * `structure-map`/`structure-table` schicken sie durch `t()`, wo das Wort
 * „H1 · Extracting" **wirft** — derselbe Absturz wie `t("L3.1")`, nur noch
 * nicht ausgelöst. Jetzt ist in beiden Zweigen ein Schlüssel, und der Name
 * sagt es.
 *
 * `mode` ist bewusst lose typisiert — die Leser reichen die Spalte durch, wie
 * sie aus der Datenbank kommt.
 */
export function horizonLabelKey(horizon: Horizon, mode: string | null | undefined): string {
  return horizon === "h1" && mode === "extracting"
    ? "org.horizon.h1Extracting"
    : HORIZON_KEYS[horizon];
}

/**
 * **Nur die Stufe** — „H1" statt „H1 · Investing".
 *
 * Für Flächen, die neben dem Horizont ohnehin schon sagen, was die Solution
 * tut, oder die schlicht keinen Platz für den Zusatz haben.
 *
 * **Sie schnitt bis September 2026 aus `HORIZON_KEYS` ab** — `"H1 · Investing"`
 * auf `"H1"`. Seit die Tabelle Schlüssel führt, enthält `org.horizon.h1` kein
 * „ · " mehr, und die Funktion gab den **ganzen Schlüssel** zurück. Sie hat
 * ohne einen Compiler-Mucks ihre Bedeutung verloren; das Rollenverzeichnis
 * zeigte den Schlüssel.
 *
 * Die Stufe steht ohnehin im Horizont selbst. Kein Katalog nötig, keine zweite
 * Quelle.
 */
export function horizonShort(horizon: Horizon): string {
  return horizon.toUpperCase();
}

/** Erklärtexte je Horizont — Quelle für Tooltips + Legende (Helfer-Schicht). */
export const HORIZON_HELP_KEYS: Record<
  Horizon,
  { blurb: string; epicArt: string; budgetFokus: string }
> = {
  h3: {
    blurb: "org.horizonHelp.h3.blurb",
    epicArt: "org.horizonHelp.h3.epicArt",
    budgetFokus: "org.horizonHelp.h3.budgetFokus",
  },
  h2: {
    blurb: "org.horizonHelp.h2.blurb",
    epicArt: "org.horizonHelp.h2.epicArt",
    budgetFokus: "org.horizonHelp.h2.budgetFokus",
  },
  h1: {
    blurb: "org.horizonHelp.h1.blurb",
    epicArt: "org.horizonHelp.h1.epicArt",
    budgetFokus: "org.horizonHelp.h1.budgetFokus",
  },
  h0: {
    blurb: "org.horizonHelp.h0.blurb",
    epicArt: "org.horizonHelp.h0.epicArt",
    budgetFokus: "org.horizonHelp.h0.budgetFokus",
  },
};

/** Kurze Konzept-Erklärungen für die Onboarding-Helfer. */
export const CONCEPT_HELP_KEYS = {
  solutionVsEpic: "org.concept.solutionVsEpic",
  grow: "org.concept.grow",
  run: "org.concept.run",
  primarySolution: "org.concept.primarySolution",
} as const;
