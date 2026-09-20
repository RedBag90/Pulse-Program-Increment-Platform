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
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import type { PointCell } from "@/modules/budgeting/domain/capacity-plan";
import type { CapacityBucket } from "@/modules/work/domain/portfolio-guardrails";
import type { ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";

/** Woher das Geld einer Zuteilung kommt. Heute nur `portfolio`. */
export type AllocationSource = "portfolio" | "art";

/**
 * **Ein Wort, eine Bedeutung.** „ART-Epic-Budget" bezeichnete an fünf Stellen
 * Verschiedenes — die Geldquelle hier, die Position im Betrieb, den Schritt der
 * Kette, die Spalte der Liste und die Kachel im Verteilformular. Der
 * **Rahmen**, aus dem ein ART seine ART-Epics bezahlt, heisst ab jetzt überall
 * „ART-Rahmen" (Spec `art-budget-consolidation.md` §2.5).
 */
export const ALLOCATION_SOURCE_LABELS: Record<AllocationSource, string> = {
  portfolio: "Portfolio-Budget",
  art: "ART-Rahmen",
};

/**
 * Warum ein Vorhaben kein Geld hat. Die Abhilfe unterscheidet sich je Fall —
 * deshalb getrennt geführt und nicht in eine Liste geworfen.
 */
/**
 * Es gab hier einen zweiten Fall, `artPot` („Vom ART-Rahmen nicht gedeckt"),
 * samt Abhilfe — **erzeugt hat ihn nie jemand**: `art-budget-detail.ts` setzt
 * ausschliesslich `ballot`. Die Frage, die er beantwortete, stellt heute die
 * Reallokations-Sicht („Beantragt, nicht finanziert"). Er ist entfernt
 * (REQ-13); kommt er zurück, kommt er mit einem Erzeuger.
 */
export type UnfundedReason = "ballot";

export const UNFUNDED_REASON_LABELS: Record<UnfundedReason, string> = {
  ballot: "Auf der PB-Liste ohne Zuteilung geblieben",
};

export const UNFUNDED_REMEDIES: Record<UnfundedReason, string> = {
  ballot: "Auf die nächste Kachel setzen.",
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
  artId: string;
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
  /**
   * **ART-eigene Arbeit ohne Epic** — eine Zeile, kein Epic.
   *
   * Sie steht immer da, auch ohne eingeplantes eigenständiges Feature: ein RTE
   * darf reservieren, bevor das erste angelegt ist.
   *
   * **Ohne Richtwert.** Der kommt aus Feature-Last × €-Satz und damit aus der
   * Deckungsrechnung (`ArtCoverage`), die neben dieser Sicht geladen wird. Ihn
   * hier zu führen hiesse, ihn entweder ein zweites Mal zu rechnen oder mit
   * einem Platzhalter zu füllen, den ein anderer Aufrufer für echt hält. Die
   * Fläche legt beides zusammen — `ownWorkGuide(coverage.plannedStandalone,
   * coverage.rate.rate)`.
   */
  ownWork: {
    amount: number;
    /** Eingefrorener Richtwert der bestehenden Reservierung; 0, solange keine da ist. */
    ask: number;
    canDistribute: boolean;
  };
  /** Die Zustandsstaffel der ART-finanzierten Zuteilungen — die zweite Quelle. */
  breakdown: AllocationBreakdown;
  titles: Record<string, string>;
}

export interface ArtCoverage {
  /** Σ Job Size der Features, die im gewählten Halbjahr eingeplant sind. */
  plannedJobSize: number;
  featureCount: number;
  /**
   * Der Teil davon, der an **keinem Epic** hängt — die eigenständige Arbeit
   * dieses ARTs im gewählten Halbjahr.
   *
   * Sie steckt in `plannedJobSize` **mit drin** und wird nicht abgezogen: das
   * ART-Budget finanziert alles, was das ART tut. Getrennt ausgewiesen wird sie
   * für den Richtwert der Reservierungszeile (`domain/art-own-work.ts`).
   */
  plannedStandalone: { jobSize: number; count: number };
  /**
   * Dieselbe eingeplante Last, aufgeteilt auf die drei Arbeitstypen — die
   * Grundlage von Guardrail 2. Σ der Eimer + `plannedUnclassified` ergibt
   * `plannedJobSize`; ein Feature ohne Typ gehört in keinen Eimer.
   */
  plannedByBucket: Record<CapacityBucket, PointCell>;
  plannedUnclassified: PointCell;
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

/**
 * **Ist an diesem ART in diesem Halbjahr überhaupt etwas?**
 *
 * Ohne diese Frage zeigt ein leerer ART eine vollständige Fläche aus Nullen:
 * drei Kacheln mit 0 €, eine leere Epic-Liste, ein Verlaufsdiagramm ohne
 * Verlauf, eine Deckungsampel auf „leer". Das sieht aus wie eine Auskunft und
 * ist keine. In „Large Setup Corp" stehen drei solcher ARTs — der Fall ist
 * Bestand, nicht Theorie.
 *
 * **Die Feature-Last zählt mit.** Ein ART ohne einen Euro, aber mit zwanzig
 * eingeplanten Features ist gerade **nicht** leer — das ist die interessanteste
 * Lage überhaupt, und sie muss sichtbar bleiben.
 */
export function artDetailIsEmpty(detail: ArtBudgetDetail): boolean {
  return (
    detail.sources.every((s) => s.breakdown.total === 0) &&
    detail.unfunded.length === 0 &&
    (detail.pot?.pot.total ?? 0) === 0 &&
    detail.rtb.run.length === 0 &&
    detail.rtb.change.length === 0 &&
    (detail.coverage?.featureCount ?? 0) === 0
  );
}
