import { computeWsjf } from "@/domain/schemas/initiative";

/**
 * **PI-Feedback** — der Business Owner bestätigt oder korrigiert nach der
 * Lieferung den Business Value der abgeschlossenen Features eines ARTs in
 * einem PI. Rein: kein I/O.
 */

/** Die WSJF-Skala, auf der auch der Ist-Wert liegt. */
export const BV_SCALE = [1, 2, 3, 5, 8, 13, 20] as const;
export type BvValue = (typeof BV_SCALE)[number];

export const isBvValue = (n: number): n is BvValue => (BV_SCALE as readonly number[]).includes(n);

export type FeedbackRequestStatus = "open" | "applied";
export type FeedbackReviewerStatus = "pending" | "submitted";

/**
 * **Der Vorschlag für den Ist-Wert:** der Mittelwert der Antworten, gerundet
 * auf den nächsten Skalenwert. Bei Gleichstand gewinnt der kleinere — ein
 * bestätigter Wert soll nicht höher ausfallen, als die Antworten tragen.
 * `null` ohne Antwort.
 */
export function suggestActual(answers: readonly number[]): BvValue | null {
  if (answers.length === 0) return null;
  const mean = answers.reduce((s, a) => s + a, 0) / answers.length;
  let best: BvValue = BV_SCALE[0];
  for (const v of BV_SCALE) {
    if (Math.abs(v - mean) < Math.abs(best - mean)) best = v;
  }
  return best;
}

/**
 * **WSJF mit Ist-Business-Value:** Time Criticality, Risk Reduction und Job
 * Size bleiben wie geplant. `null`, wenn das Feature nicht vollständig
 * bewertet ist — dann gibt es auch keinen Plan-WSJF, gegen den das Ist stünde.
 */
export function actualWsjf(
  feature: {
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
  },
  businessValueActual: number,
): number | null {
  const { wsjfTimeCriticality: tc, wsjfRiskReduction: rr, wsjfJobSize: js } = feature;
  if (tc == null || rr == null || js == null || js <= 0) return null;
  return computeWsjf({
    businessValue: businessValueActual,
    timeCriticality: tc,
    riskReduction: rr,
    jobSize: js,
  } as Parameters<typeof computeWsjf>[0]);
}

/** Überfällig: eine Frist, die vor dem heutigen Tag lag (Tagesgenauigkeit). */
export function isOverdue(dueDate: Date | null, now: Date): boolean {
  if (!dueDate) return false;
  const heute = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueDate.getTime() < heute;
}
