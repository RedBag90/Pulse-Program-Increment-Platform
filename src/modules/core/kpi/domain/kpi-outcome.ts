/**
 * Das **Ergebnis** einer Erfolgs-KPI: Plan gegen Ist, zerlegt in Menge und Wert.
 * Rein, kein I/O, keine Uhr.
 *
 * Ein Epic kann auf zwei unabhängigen Achsen über- oder unterliefern, und beide
 * bedeuten etwas anderes:
 *
 *   **Menge** — wie weit die KPI ihr Ziel erreicht hat. Sie friert mit der
 *   Abnahme von L4.2 („die Umsetzung ist fertig"): was gebaut ist, ist gebaut,
 *   und ein projizierter Rest wäre eine Behauptung ohne Grundlage. Unter 100 %
 *   verfällt der Rest, über 100 % zählt er voll — deshalb rechnet dieses Modul
 *   **ohne obere Deckelung**.
 *
 *   **Wert** — mit welchem Faktor eine Einheit Verbesserung in Geld (oder in
 *   Ziel-Einheiten) umgerechnet wird. Den verantwortet Finance, und er bleibt
 *   bis zur Impact-Abnahme (L5) korrigierbar: erst nach der Umsetzung zeigt
 *   sich, ob eine Einheit wirklich so viel wert war. Eine Korrektur wirkt
 *   **rückwirkend** auf die ganze Ist-Rechnung.
 *
 * Damit die beiden Achsen überhaupt messbar sind, braucht es einen festen
 * Bezugspunkt: den **Plan-Schnappschuss**, gezogen bei der Freigabe des
 * Business Case (L2 → L3.1). Ohne ihn misst sich der Plan an sich selbst und
 * zeigt immer null Abweichung.
 */

import { fulfillmentFraction } from "@/modules/core/kpi/domain/kpi-direction";
import {
  measurementPoints,
  measurementValueAt,
  type KpiMeasurement,
} from "@/modules/core/kpi/domain/kpi";
import { benefitKindOrDefault } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { recurringIntervalOrDefault } from "@/modules/core/kpi/domain/kpi-recurring-interval";

/** Die Größen, aus denen ein Nutzenbetrag entsteht — Live-Stand oder Plan. */
export interface KpiValuationTerms {
  baseline: number | null;
  target: number | null;
  /** € je Einheit bzw. Ziel-Einheit je Einheit. */
  valuePerUnit: number | null;
  benefitKind?: string;
  recurringInterval?: string;
}

export interface KpiOutcomeInput extends KpiValuationTerms {
  measurements: KpiMeasurement[];
  /**
   * Der Plan-Stand zur Business-Case-Freigabe. `null` bei Epics, die vor der
   * Einführung des Schnappschusses freigegeben wurden — dann gilt der
   * Live-Stand, und Plan und Ist fallen zusammen.
   */
  planSnapshot: KpiValuationTerms | null;
  /**
   * Zeitpunkt der L4.2-Abnahme (`implementationCompletedAt`). Gesetzt ⇒ die
   * Menge ist eingefroren: es zählt der Messwert zu diesem Stichtag, spätere
   * Messungen bewegen das Ergebnis nicht mehr.
   */
  frozenAt: Date | null;
}

export interface KpiOutcome {
  /** Nutzen bei 100 % Zielerreichung, zu den **Plan**-Größen. */
  planned: number;
  /** Tatsächlicher Nutzen: eingefrorene Zielerreichung × **aktuelle** Größen. */
  realized: number;
  /** Zielerreichung als Anteil — 0.7 = 70 %, 1.3 = 130 %. Nach unten bei 0. */
  attainment: number;
  /** Anteil der Abweichung, der aus der Menge kommt (zum Plan-Faktor bewertet). */
  quantityDelta: number;
  /** Anteil, der aus der Korrektur des Faktors kommt (zur Ist-Menge bewertet). */
  valueDelta: number;
  /** `true`, sobald die Umsetzung abgenommen ist — die Menge steht fest. */
  frozen: boolean;
}

/**
 * Liest einen gespeicherten Plan-Schnappschuss (JSON-Spalte). Unbrauchbare
 * Formen ergeben `null` — ein halb lesbarer Plan wäre schlimmer als keiner,
 * weil er eine Abweichung erfände.
 *
 * Die Ziel-Verknüpfung speichert ihren Faktor unter `conversionFactor` und ihre
 * Nutzenart unter `impactKind`; deshalb werden beide Namenspaare akzeptiert.
 * Die Mengen-Größen (`baseline`/`target`) trägt dort die treibende KPI — der
 * Aufrufer legt sie über `over` bei.
 */
export function parsePlanSnapshot(
  raw: unknown,
  over: Partial<KpiValuationTerms> = {},
): KpiValuationTerms | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.benefitKind ?? o.impactKind;
  return {
    baseline: toNum(o.baseline),
    target: toNum(o.target),
    valuePerUnit: toNum(o.valuePerUnit ?? o.conversionFactor),
    ...(typeof kind === "string" ? { benefitKind: kind } : {}),
    ...(typeof o.recurringInterval === "string" ? { recurringInterval: o.recurringInterval } : {}),
    ...over,
  };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Jahres-Äquivalent eines Faktors: monatlich wiederkehrend zählt ×12. */
function intervalFactor(terms: KpiValuationTerms): number {
  if (benefitKindOrDefault(terms.benefitKind ?? "recurring") === "one_time") return 1;
  return recurringIntervalOrDefault(terms.recurringInterval ?? "yearly") === "monthly" ? 12 : 1;
}

/** Nutzen bei 100 % Zielerreichung: |Ziel − Baseline| × Faktor × Intervall. */
export function valueAtFullTarget(terms: KpiValuationTerms): number {
  const { baseline, target, valuePerUnit } = terms;
  if (baseline == null || target == null || valuePerUnit == null) return 0;
  const span = Math.abs(target - baseline);
  if (span === 0) return 0;
  return span * valuePerUnit * intervalFactor(terms);
}

/**
 * Zielerreichung, **ohne obere Grenze** und nach unten bei 0 abgeschnitten.
 *
 * Die Deckelung auf 100 % (`kpiAttainment` in `kpi-valuation.ts`) ist für
 * Fortschritts-Anzeigen richtig — für einen Nutzenbetrag nicht: wer 130 %
 * geliefert hat, hat 130 % geliefert. Nach unten wird abgeschnitten, weil eine
 * Verschlechterung gegenüber der Baseline kein *negativer* Nutzen dieses Epics
 * ist, sondern schlicht keiner.
 */
export function outcomeAttainment(
  terms: Pick<KpiValuationTerms, "baseline" | "target">,
  value: number | null,
): number {
  const raw = fulfillmentFraction(terms.baseline, terms.target, value);
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

/**
 * Der Messwert, der zählt: zum Einfrier-Stichtag, sonst der letzte überhaupt.
 * Vor der ersten Messung gilt die Baseline — also 0 % Zielerreichung, nicht
 * „unbekannt".
 */
export function decisiveValue(input: KpiOutcomeInput): number | null {
  const points = measurementPoints(input.measurements);
  const cutoff = input.frozenAt ? input.frozenAt.getTime() : Number.POSITIVE_INFINITY;
  return measurementValueAt(points, cutoff, input.baseline);
}

/**
 * Plan, Ist und die Zerlegung der Abweichung.
 *
 * Die Zerlegung ist exakt: `quantityDelta + valueDelta === realized − planned`.
 * Sie schreibt die Mengen-Abweichung dem **Plan**-Faktor zu und die
 * Wert-Abweichung der **Ist**-Menge — so trägt jede Achse genau den Teil, den
 * sie verursacht hat, und beide zusammen erklären die Differenz vollständig.
 */
export function kpiOutcome(input: KpiOutcomeInput): KpiOutcome {
  const planTerms = input.planSnapshot ?? input;
  const planned = valueAtFullTarget(planTerms);
  const atFullNow = valueAtFullTarget(input);
  const attainment = outcomeAttainment(input, decisiveValue(input));
  const realized = attainment * atFullNow;

  return {
    planned,
    realized,
    attainment,
    quantityDelta: (attainment - 1) * planned,
    valueDelta: attainment * (atFullNow - planned),
    frozen: input.frozenAt != null,
  };
}
