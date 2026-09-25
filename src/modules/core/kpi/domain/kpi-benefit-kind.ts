/**
 * Benefit-Art einer KPI: misst sie den **Einmal**-Nutzen (one_time) oder den
 * **wiederkehrenden** Nutzen (recurring) des Epics? Treibt die Ökonomie — eine
 * one-time-KPI realisiert ihren Wert einmalig, eine recurring-KPI als laufende
 * jährliche Run-Rate. Default `recurring` (= Alt-Verhalten für Bestands-KPIs).
 */
export const BENEFIT_KINDS = ["one_time", "recurring"] as const;
export type BenefitKind = (typeof BENEFIT_KINDS)[number];

export function isBenefitKind(s: string | null | undefined): s is BenefitKind {
  return s != null && (BENEFIT_KINDS as readonly string[]).includes(s);
}

/** Effektive Art: gültiger gespeicherter Wert, sonst `recurring`. */
export function benefitKindOrDefault(s: string | null | undefined): BenefitKind {
  return isBenefitKind(s) ? s : "recurring";
}

/** Katalog-Schlüssel, keine Wörter — die Fläche übersetzt (ADR-0024, Regel 2). */
export const BENEFIT_KIND_KEYS: Record<BenefitKind, string> = {
  one_time: "work.benefitKind.oneTime",
  recurring: "work.benefitKind.recurring",
};
