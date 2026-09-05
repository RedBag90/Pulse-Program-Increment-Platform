/**
 * Das Seitenmodell der ART-Budgetfläche: die Typen, das Anzeige-Vokabular und
 * die Ampelregel.
 *
 * Eigene Datei, seit `art-budget-detail.ts` zerlegt wurde. Sie hat zwei Gründe:
 * die Loader teilen sich diese Formen (Deckung, Verteilliste, Falter), und ohne
 * sie zeigten die Loader-Dateien mit Typ-Importen im Kreis aufeinander.
 *
 * Rein, kein I/O.
 *
 * Lag bis September 2026 in `server/views/`, obwohl zwei Services und zwei
 * Komponenten die Formen von hier bezogen — der Ordner der Seitenmodelle wurde
 * damit von unten importiert. Seit `ArtPot` weg ist, kennt die Datei nichts
 * außer Domäne und gehört dorthin.
 */

import type { AllocationBreakdown } from "@/modules/budgeting/domain/allocation-state";
import type { AllocationCourse } from "@/modules/budgeting/domain/allocation-course";
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import type { ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";

/** Woher das Geld einer Zuteilung kommt. Heute nur `portfolio`. */
export type AllocationSource = "portfolio" | "art";

export const ALLOCATION_SOURCE_LABELS: Record<AllocationSource, string> = {
  portfolio: "Portfolio-Budget",
  art: "ART-Epic-Budget",
};

/**
 * Warum ein Vorhaben kein Geld hat. Die Abhilfe unterscheidet sich je Fall —
 * deshalb getrennt geführt und nicht in eine Liste geworfen.
 */
export type UnfundedReason = "ballot" | "artPot";

export const UNFUNDED_REASON_LABELS: Record<UnfundedReason, string> = {
  ballot: "Auf der PB-Liste ohne Zuteilung geblieben",
  artPot: "Vom ART-Rahmen nicht gedeckt",
};

export const UNFUNDED_REMEDIES: Record<UnfundedReason, string> = {
  ballot: "Auf die nächste Kachel setzen.",
  artPot: "Einen größeren Rahmen beantragen.",
};

export interface UnfundedCandidate {
  epicId: string;
  title: string;
  stageGate: string | null;
  ask: number;
  reason: UnfundedReason;
}

export interface ArtBudgetSourceView {
  source: AllocationSource;
  label: string;
  breakdown: AllocationBreakdown;
  /** Titel je Epic, damit die Fläche die Staffel-Zeilen benennen kann. */
  titles: Record<string, string>;
}

export interface ArtBudgetDetail {
  /** `null` bei einer Sicht ohne ART — dem Wertstrom-Verlauf. */
  artId: string | null;
  /** Halbjahre mit Zuteilung, neueste zuerst — die Auswahl des Umschalters. */
  cycles: { key: string; label: string }[];
  cycleKey: string;
  sources: ArtBudgetSourceView[];
  /** Epics, deren ART sich nach der Zuteilung geändert hat. */
  switchedArt: { epicId: string; title: string; currentArtName: string | null }[];
  /** Zuteilungen des Wertstroms an Epics ohne ART — sie fehlen in jeder ART-Sicht. */
  epicsWithoutArt: { count: number; amount: number };
  /** Beantragt und leer ausgegangen — die Gegenseite der Reallokations-Sicht. */
  unfunded: UnfundedCandidate[];
  /** Der Monatsverlauf des gewählten Halbjahres, je Quelle. */
  course: Record<AllocationSource, AllocationCourse | null>;
  /** Index des laufenden Monats auf der Achse; −1 = außerhalb des Halbjahres. */
  todayIndex: number;
  /** Last gegen Deckung — `null`, solange kein ART-Budget geladen wurde. */
  coverage: ArtCoverage | null;
  /** Der ART-Epic-Budget und seine Verteilung — `null`, wenn Practice aus. */
  pot: ArtPotView | null;
  /** Run-the-Business-Positionen dieses ARTs, nach Art getrennt. */
  rtb: {
    run: { id: string; name: string; cycleAmount: number; annualAmount: number }[];
    change: { id: string; name: string; cycleAmount: number; annualAmount: number }[];
  };
}

export interface ArtPotView {
  pot: ArtEpicBudget;
  /**
   * Die ART-Epics dieses ARTs, die vorgemerkt und budgeting-reif sind — mit
   * ihrem eingefrorenen Richtwert, sobald einmal zugeteilt wurde.
   */
  rows: {
    epicId: string;
    title: string;
    stageGate: string;
    ask: number;
    amount: number;
    /** `true`, wenn der aktuelle Business Case vom eingefrorenen Richtwert abweicht. */
    askDrifted: boolean;
    /**
     * Darf der Betrachter **diese** Zeile bedienen? Für Capability-Träger und
     * die Finance-Partei gilt das überall; ein Produkt-Manager darf nur bei den
     * Epics seiner eigenen Solution. Ein Feld, das aussieht wie ein Feld und
     * beim Speichern ablehnt, wäre die schlechtere Auskunft.
     */
    canDistribute: boolean;
  }[];
  /** Die Zustandsstaffel der ART-finanzierten Zuteilungen — die zweite Quelle. */
  breakdown: AllocationBreakdown;
  titles: Record<string, string>;
}

export interface ArtCoverage {
  /** Σ Job Size der Features, die im gewählten Halbjahr eingeplant sind. */
  plannedJobSize: number;
  featureCount: number;
  rate: JobSizeRate;
  /** Last in Geld — `null`, wenn kein Satz vorliegt. */
  loadEuro: number | null;
  allocated: number;
  /** `loadEuro − allocated`; positiv = überbucht. `null` ohne Satz. */
  gap: number | null;
}

/**
 * Wie die Deckungs-Ampel zu lesen ist.
 *
 * `empty` ist der eigene Zustand für „hier ist noch gar nichts": ohne ihn
 * meldete ein ART ohne eingeplante Features und ohne Zuteilung **„Gedeckt"** —
 * eine Entwarnung über nichts.
 */
export type CoverageVerdict = "empty" | "unknown" | "over" | "covered";

export function coverageVerdict(coverage: ArtCoverage): CoverageVerdict {
  if (coverage.plannedJobSize === 0 && coverage.allocated === 0) return "empty";
  if (coverage.gap == null) return "unknown";
  return coverage.gap > 0 ? "over" : "covered";
}
