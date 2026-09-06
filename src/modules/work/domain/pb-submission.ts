/**
 * Ableitung der Participatory-Budgeting-Einreichungsinfos eines Epics.
 *
 * Die PB-Infos werden nicht manuell gepflegt, sondern aus dem **freigegebenen
 * Lean Business Case** abgeleitet: Infos aus seinen Feldern, Kosten-Richtwert als
 * Σ `costSlices`.
 *
 * **Bis September 2026 gab es einen zweiten Weg.** Ein Epic mit bloß
 * freigegebener Benefit-Hypothese kam ebenfalls auf die PB-Liste und bekam einen
 * pauschalen Richtwert — „grob der Aufwand, um den LBC zu erarbeiten", aus einem
 * tenant-konfigurierbaren Default. Das Portfolio budgetierte damit die
 * **Erstellung** des Business Case, nicht nur seine Umsetzung. Dieser Weg ist
 * entfallen: die Analyse- und Business-Case-Arbeit läuft aus der laufenden
 * Kapazität von Wertstrom und ART.
 *
 * Damit erreicht nur noch ein Epic **ab L3.1** die PB-Liste — dieselbe Grenze,
 * die `budgeting/domain/allocation-eligibility.ts` zieht, hier am Eingang
 * durchgesetzt statt nur in den Seeds.
 *
 * Rein, kein I/O.
 */

import {
  parseBusinessCase,
  computeBusinessCaseTotals,
  type BusinessCaseFields,
} from "@/modules/work/domain/business-case";

/**
 * Die Approval-Stempel. `hypothesisApprovedAt` bleibt Teil der Form, weil die
 * Aufrufer ihn ohnehin laden — für die Eligibility zählt er **nicht** mehr.
 */
export interface PbApprovalState {
  businessCaseApprovedAt: Date | null;
  hypothesisApprovedAt?: Date | null;
}

/** Roh-Quelle für die Ableitung: die JSON-Artefakte + die Approval-Stempel. */
export interface PbSource extends PbApprovalState {
  /** Stored `businessCase` JSON (versioniert oder legacy — `parseBusinessCase` handelt beides). */
  businessCase: unknown;
  /** Stored `benefitHypothesis` JSON. */
  benefitHypothesis: unknown;
}

export type PbSourceKind = "lbc" | "none";

export interface PbInfoRow {
  label: string;
  value: string;
}

export interface PbCandidateInfo {
  /** true, sobald ein freigegebener Lean Business Case vorliegt. */
  ready: boolean;
  source: PbSourceKind;
  /** Kosten-Richtwert (ask): Σ costSlices des LBC; ohne LBC 0. */
  cost: number;
  /** Quellen-abhängiger Read-only-Readout; leere Felder ausgelassen. */
  rows: PbInfoRow[];
}

/**
 * Ist das Epic budgeting-reif? **Nur mit freigegebenem Lean Business Case.**
 *
 * Eine freigegebene Benefit-Hypothese reicht nicht mehr: das Portfolio
 * finanziert die Umsetzung, nicht die Erarbeitung des Business Case.
 */
export function isPbEligible(e: PbApprovalState): boolean {
  return e.businessCaseApprovedAt != null;
}

/** Welches Artefakt speist die PB-Infos — nur der freigegebene LBC. */
export function pbSourceKind(e: PbApprovalState): PbSourceKind {
  return e.businessCaseApprovedAt != null ? "lbc" : "none";
}

function pushText(rows: PbInfoRow[], label: string, v: string | undefined): void {
  if (v != null && v.trim() !== "") rows.push({ label, value: v.trim() });
}

function lbcRows(bc: BusinessCaseFields): PbInfoRow[] {
  const rows: PbInfoRow[] = [];
  pushText(rows, "Beschreibung", bc.initiativeDescription);
  pushText(rows, "Business-Outcome", bc.businessOutcomeHypothesis);
  pushText(rows, "In Scope", bc.inScope);
  pushText(rows, "Out of Scope", bc.outOfScope);
  pushText(rows, "Annahmen", bc.whatYouNeedToBelieve);
  return rows;
}

/** Leitet die PB-Kandidaten-Info eines Epics aus seinem Business Case ab. */
export function derivePbInfo(source: PbSource): PbCandidateInfo {
  if (pbSourceKind(source) !== "lbc") {
    return { ready: false, source: "none", cost: 0, rows: [] };
  }
  const bc = parseBusinessCase(source.businessCase).current;
  return {
    ready: true,
    source: "lbc",
    cost: computeBusinessCaseTotals(bc).implementationCost,
    rows: lbcRows(bc),
  };
}

/** Menschlicher Quellen-Label für den Readout-Header. */
export function pbSourceLabel(source: PbSourceKind): string {
  return source === "lbc" ? "aus Lean Business Case" : "";
}

// ---------------------------------------------------------------------------
// Guardrail 3 — Portfolio-Epic oder ART-Epic
// ---------------------------------------------------------------------------

/**
 * Die Klasse eines Epics. `null` = noch nicht einzuordnen.
 *
 * **Nur ein freigegebener Lean Business Case begründet eine Klasse.** Wer nur
 * eine Hypothese hat, trägt keine Kostenschätzung, sondern den tenant-weiten
 * Default-Aufwand — und der liegt unter jedem sinnvollen Limit. Würde er
 * klassifizieren, träfe die Regel eine Aussage über die **Reife** des Artefakts
 * und gäbe sie als Aussage über die **Größe** aus.
 *
 * Am echten Datenbestand gemessen (2026-09-02): von 18 budgeting-reifen Epics
 * lagen genau die 7 ohne Business Case unter dem Limit — und trugen zugleich
 * 1,66 Mio. € an Zuteilungen, das Vierfache ihres Richtwerts.
 */
export type EpicClass = "portfolio" | "art";

export interface EpicClassState extends PbApprovalState {
  businessCase: unknown;
  /** Gesetzt = Ausnahme aktiv: das Epic gehört unabhängig von den Kosten ins Portfolio. */
  portfolioOverrideAt: Date | null;
}

export interface EpicClassification {
  epicClass: EpicClass | null;
  /** Die Kosten, gegen die entschieden wurde — `null`, wenn keine vorliegen. */
  cost: number | null;
  /** Das Limit, gegen das entschieden wurde. */
  threshold: number;
  /** `true`, wenn die Ausnahme die Kostenregel überstimmt hat. */
  overridden: boolean;
}

/**
 * Ordnet ein Epic ein: `Kosten > Limit` → Portfolio, sonst ART. Ein gesetzter
 * Override hebt es unabhängig von den Kosten ins Portfolio.
 *
 * Gleichstand ist ein ART-Epic — die Schwelle ist die Untergrenze dessen, was
 * das Portfolio entscheidet.
 */
export function classifyEpic(e: EpicClassState, threshold: number): EpicClassification {
  if (e.portfolioOverrideAt != null) {
    return { epicClass: "portfolio", cost: null, threshold, overridden: true };
  }
  if (e.businessCaseApprovedAt == null) {
    return { epicClass: null, cost: null, threshold, overridden: false };
  }
  const cost = computeBusinessCaseTotals(
    parseBusinessCase(e.businessCase).current,
  ).implementationCost;
  return {
    epicClass: cost > threshold ? "portfolio" : "art",
    cost,
    threshold,
    overridden: false,
  };
}

export const EPIC_CLASS_LABELS: Record<EpicClass, string> = {
  portfolio: "Portfolio-Epic",
  art: "ART-Epic",
};

/** Die beim Anlegen hinterlegte Erwartung; `null` = keine (Bestands-Epics). */
export type IntendedClass = EpicClass | null;

export function isEpicClass(v: string | null | undefined): v is EpicClass {
  return v === "portfolio" || v === "art";
}

/** Woher die angezeigte Klasse stammt. */
export type EpicClassSource = "approved" | "intended" | "none";

export interface ResolvedEpicClass {
  /** Aufgelöst: entschieden ?? erwartet. */
  epicClass: EpicClass | null;
  classSource: EpicClassSource;
}

/**
 * Die Einordnung in **zwei Stufen**: entschieden, sonst erwartet.
 *
 * Bis September 2026 gab es nur die erste. Solange kein Business Case
 * freigegeben war, blieb die Klasse `null` — und die Facette „Epic-Klasse" der
 * Portfolio-Übersicht fand damit **103 von 226** Epics. Die übrigen 123 trugen
 * längst eine Erwartung (der Anlege-Dialog verlangt sie), die nirgends gelesen
 * wurde.
 *
 * **Die Rangfolge ist eine Einbahnstraße.** Ist entschieden, gewinnt die
 * Entscheidung immer; eine Erwartung überschreibt sie nie. Genau das meint der
 * Schema-Kommentar mit „sie entscheidet nichts": sie entscheidet nicht *statt*
 * der Kosten, sie springt nur ein, solange die Kosten noch nichts sagen.
 *
 * Rein, kein I/O.
 */
export function resolveEpicClass(
  decided: EpicClass | null,
  intended: IntendedClass,
): ResolvedEpicClass {
  if (decided != null) return { epicClass: decided, classSource: "approved" };
  if (intended != null) return { epicClass: intended, classSource: "intended" };
  return { epicClass: null, classSource: "none" };
}

/**
 * Wie die abgeleitete Klasse von der Erwartung abweicht.
 *
 * - `none` — sie stimmen überein, oder es gibt (noch) nichts zu vergleichen:
 *   ohne Erwartung, oder solange der Business Case nicht freigegeben ist.
 * - `up` — erwartet ART, abgeleitet **Portfolio**: das Vorhaben ist größer als
 *   gedacht und braucht eine Portfolio-Entscheidung.
 * - `down` — erwartet Portfolio, abgeleitet **ART**: es fällt unter das Limit
 *   und hängt künftig am Rahmen seines ARTs statt an der PB-Liste.
 */
export type ClassificationDrift = "none" | "up" | "down";

export function classificationDrift(
  intended: IntendedClass,
  derived: EpicClass | null,
): ClassificationDrift {
  if (intended == null || derived == null || intended === derived) return "none";
  return derived === "portfolio" ? "up" : "down";
}

/**
 * Darf auf der Erwartung bestanden werden?
 *
 * **Nur nach unten.** Erwartet Portfolio, abgeleitet ART: dann kann jemand mit
 * dem Recht erklären, dass es Portfolio-Sache bleibt — dafür gibt es den
 * `portfolioOverride`. In die andere Richtung bindet die Kostenregel: was über
 * dem Limit liegt, braucht eine Portfolio-Entscheidung. Ein Bestehen wäre dort
 * auch praktisch leer, weil ein ART-Epic aus dem ART-Epic-Budget bezahlt
 * wird und der Schreibpfad jede Zuteilung am Rahmen deckelt.
 */
export function driftAllowsOverride(drift: ClassificationDrift): boolean {
  return drift === "down";
}
