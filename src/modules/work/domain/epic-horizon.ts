import { type Horizon, isHorizon } from "@/modules/work/domain/portfolio-guardrails";

/**
 * Der Investitionshorizont eines **Epics** — als reine Auflösung.
 *
 * Bis September 2026 wurde er bei jedem Lesen aus der Primär-Solution
 * abgeleitet (`e.primarySolution?.horizon ?? null`), an sechs Stellen wortgleich.
 * Daraus folgten zwei Lücken:
 *
 *  1. **Ohne Solution kein Horizont.** Das Epic fiel in die Bahn „Ohne" und
 *     zählte in keiner Guardrail-Quote mit — und die Solution ist im
 *     Anlege-Dialog optional.
 *  2. **Die Geschichte wurde rückwirkend umgeschrieben.** Wanderte eine Solution
 *     von `h2` nach `h1`, wechselten *alle* ihre Epics den Horizont, auch
 *     abgeschlossene. Ein einziger Solution-Wechsel verschob damit die gemessene
 *     Portfolio-Balance der Vergangenheit.
 *
 * Beides löst dieselbe Regel: **explizit schlägt abgeleitet**, und mit der
 * Business-Case-Freigabe friert der explizite Wert ein.
 *
 * `frozen` ist **abgeleitet, kein zweites Feld**: „steht am Epic *und* der Lean
 * Business Case ist durch". Ein von Hand gesetzter Wert vor der Freigabe gilt
 * also schon, ist aber noch änderbar.
 *
 * Rein, kein I/O.
 */

/** Woher der Horizont kommt — für die Fläche, die das benennen muss. */
export type EpicHorizonSource = "epic" | "solution" | "none";

export interface EpicHorizonFacts {
  /** Der am Epic gesetzte Wert (`Initiative.investmentHorizon`). */
  investmentHorizon: string | null;
  /** Der Horizont der Primär-Solution, falls es eine gibt. */
  solutionHorizon: string | null;
  /** Der L3.1-Stempel. Gesetzt ⇒ ein eigener Wert ist eingefroren. */
  businessCaseApprovedAt: Date | null;
}

export interface EpicHorizonResolution {
  horizon: Horizon | null;
  source: EpicHorizonSource;
  /** `true` ⇔ der Wert steht am Epic **und** der Business Case ist freigegeben. */
  frozen: boolean;
}

export function epicHorizon(facts: EpicHorizonFacts): EpicHorizonResolution {
  // Ein unbekannter Wert in der Spalte zählt wie keiner — die Auflösung fällt
  // dann auf die Solution zurück, statt einen Fantasie-Horizont zu behaupten.
  const own = isHorizon(facts.investmentHorizon) ? facts.investmentHorizon : null;
  if (own !== null) {
    return { horizon: own, source: "epic", frozen: facts.businessCaseApprovedAt != null };
  }
  const derived = isHorizon(facts.solutionHorizon) ? facts.solutionHorizon : null;
  if (derived !== null) return { horizon: derived, source: "solution", frozen: false };
  return { horizon: null, source: "none", frozen: false };
}

/** Kurzform für die sechs Lesestellen, die nur den Wert brauchen. */
export function resolveEpicHorizon(facts: EpicHorizonFacts): Horizon | null {
  return epicHorizon(facts).horizon;
}

// ---------------------------------------------------------------------------
// Wer ihn ändern darf
// ---------------------------------------------------------------------------

export interface HorizonEditFacts {
  /** Der aufgelöste Zustand aus `epicHorizon`. */
  frozen: boolean;
  /** Der Aufrufer darf dieses Epic schreiben (`epic.update`). */
  mayEditEpic: boolean;
  /** Der Aufrufer darf eine Portfolio-Einordnung überstimmen (`epic.portfolio_override`). */
  mayOverride: boolean;
}

const NO_EDIT =
  "Nur wer das Epic bearbeiten darf, kann seinen Horizont setzen (Capability `epic.update`).";
const FROZEN =
  "Der Horizont ist mit der Business-Case-Freigabe eingefroren. Ihn nachträglich zu ändern " +
  "ist dem Portfolio-Management vorbehalten (Capability `epic.portfolio_override`).";

/**
 * `null` = erlaubt. Sonst der Grund — wie `epicLinkDeniedReason` und
 * `rtbManageDeniedReason`: sagen, **warum** nicht, statt nur „nein".
 *
 * Das Übersteuerungsrecht ist eine **zusätzliche** Hürde, kein Ersatz: der
 * eingefrorene Wert gehört einer Abnahme durch fünf Parteien, und ihn zu
 * bewegen ist eine Portfolio-Entscheidung — aber immer noch eine Änderung am
 * Epic.
 */
export function horizonEditDeniedReason(facts: HorizonEditFacts): string | null {
  if (!facts.mayEditEpic) return NO_EDIT;
  if (facts.frozen && !facts.mayOverride) return FROZEN;
  return null;
}
