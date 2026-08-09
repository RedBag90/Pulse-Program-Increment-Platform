/**
 * Intervall eines **wiederkehrenden** KPI-Benefits: beschreibt der vorgeschlagene
 * €-Wert (`valuePerUnit` × |Ziel−Baseline|) einen **monatlich** (monthly) oder
 * einen **jährlich** (yearly) wiederkehrenden Mehrwert? Treibt die Run-Rate —
 * eine monatliche KPI liefert ihren Periodenwert direkt je Monat, eine jährliche
 * verteilt ihn auf /12. Default `yearly` (= Alt-Verhalten für Bestands-KPIs).
 * Nur relevant, wenn benefitKind === "recurring".
 */
export const RECURRING_INTERVALS = ["monthly", "yearly"] as const;
export type RecurringInterval = (typeof RECURRING_INTERVALS)[number];

export function isRecurringInterval(s: string | null | undefined): s is RecurringInterval {
  return s != null && (RECURRING_INTERVALS as readonly string[]).includes(s);
}

/** Effektives Intervall: gültiger gespeicherter Wert, sonst `yearly`. */
export function recurringIntervalOrDefault(s: string | null | undefined): RecurringInterval {
  return isRecurringInterval(s) ? s : "yearly";
}

export const RECURRING_INTERVAL_LABELS: Record<RecurringInterval, string> = {
  monthly: "pro Monat",
  yearly: "pro Jahr",
};
