/**
 * Ableitung der Participatory-Budgeting-Einreichungsinfos eines Epics.
 *
 * Die PB-Infos werden NICHT mehr manuell gepflegt, sondern aus den vorhandenen
 * Artefakten abgeleitet:
 *   - approved **Lean Business Case** (`businessCaseApprovedAt != null`) → Infos +
 *     Kosten-Richtwert (Σ costSlices) aus dem LBC;
 *   - sonst approved **Benefit-Hypothese** (`hypothesisApprovedAt != null`) → Infos
 *     aus der Hypothese; der Kosten-Richtwert kommt aus einem tenant-konfigurierbaren
 *     Default (grob der Aufwand, um den LBC zu erarbeiten).
 *
 * Rein, kein I/O. Ersetzt das frühere manuelle `submission.ts`-Vollständigkeits-Gate.
 */

import {
  parseBusinessCase,
  computeBusinessCaseTotals,
  type BusinessCaseFields,
} from "@/modules/work/domain/business-case";
import {
  parseBenefitHypothesis,
  type BenefitHypothesisFields,
} from "@/modules/work/domain/benefit-hypothesis";

/** Code-Fallback, wenn der Tenant keinen Default-Aufwand gesetzt hat. */
export const DEFAULT_HYPOTHESIS_EFFORT = 50_000;

/** Die zwei Approval-Stempel, die die Eligibility bestimmen. */
export interface PbApprovalState {
  businessCaseApprovedAt: Date | null;
  hypothesisApprovedAt: Date | null;
}

/** Roh-Quelle für die Ableitung: die JSON-Artefakte + die Approval-Stempel. */
export interface PbSource extends PbApprovalState {
  /** Stored `businessCase` JSON (versioniert oder legacy — `parseBusinessCase` handelt beides). */
  businessCase: unknown;
  /** Stored `benefitHypothesis` JSON. */
  benefitHypothesis: unknown;
}

export type PbSourceKind = "lbc" | "hypothesis" | "none";

export interface PbInfoRow {
  label: string;
  value: string;
}

export interface PbCandidateInfo {
  /** true, sobald eine approved Hypothese ODER ein approved LBC vorliegt. */
  ready: boolean;
  source: PbSourceKind;
  /** Kosten-Richtwert (ask): LBC → Σ costSlices; nur-Hypothese → defaultEffort; none → 0. */
  cost: number;
  /** Quellen-abhängiger Read-only-Readout; leere Felder ausgelassen. */
  rows: PbInfoRow[];
}

/** Ist das Epic budgeting-reif (mind. eine approved Hypothese oder ein LBC)? */
export function isPbEligible(e: PbApprovalState): boolean {
  return e.businessCaseApprovedAt != null || e.hypothesisApprovedAt != null;
}

/** Welches Artefakt speist die PB-Infos — approved LBC gewinnt vor Hypothese. */
export function pbSourceKind(e: PbApprovalState): PbSourceKind {
  if (e.businessCaseApprovedAt != null) return "lbc";
  if (e.hypothesisApprovedAt != null) return "hypothesis";
  return "none";
}

function pushText(rows: PbInfoRow[], label: string, v: string | undefined): void {
  if (v != null && v.trim() !== "") rows.push({ label, value: v.trim() });
}

function pushList(rows: PbInfoRow[], label: string, v: string[] | undefined): void {
  const items = (v ?? []).map((s) => s.trim()).filter((s) => s !== "");
  if (items.length > 0) rows.push({ label, value: items.join(" · ") });
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

function hypothesisRows(h: BenefitHypothesisFields): PbInfoRow[] {
  const rows: PbInfoRow[] = [];
  pushText(rows, "Maßnahmen-Hypothese", h.measuresHypothesis);
  pushText(rows, "Veränderung ggü. Baseline", h.changeFromBaseline);
  pushList(rows, "Business Outcomes", h.businessOutcomes);
  pushList(rows, "Frühindikatoren", h.leadingIndicators);
  pushList(rows, "Risiken", h.risks);
  return rows;
}

/**
 * Leitet die PB-Kandidaten-Info eines Epics aus seinen Artefakten ab. `defaultEffort`
 * ist der tenant-konfigurierte Kosten-Richtwert für nur-Hypothese-Epics.
 */
export function derivePbInfo(source: PbSource, defaultEffort: number): PbCandidateInfo {
  const kind = pbSourceKind(source);
  if (kind === "lbc") {
    const bc = parseBusinessCase(source.businessCase).current;
    return {
      ready: true,
      source: "lbc",
      cost: computeBusinessCaseTotals(bc).implementationCost,
      rows: lbcRows(bc),
    };
  }
  if (kind === "hypothesis") {
    const hyp = parseBenefitHypothesis(source.benefitHypothesis).current;
    return {
      ready: true,
      source: "hypothesis",
      cost: defaultEffort,
      rows: hypothesisRows(hyp),
    };
  }
  return { ready: false, source: "none", cost: 0, rows: [] };
}

/** Menschlicher Quellen-Label für den Readout-Header. */
export function pbSourceLabel(source: PbSourceKind): string {
  switch (source) {
    case "lbc":
      return "aus Lean Business Case";
    case "hypothesis":
      return "aus Benefit-Hypothese";
    default:
      return "";
  }
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
