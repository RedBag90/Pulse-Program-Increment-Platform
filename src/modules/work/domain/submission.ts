/**
 * Vollständigkeits-Gate der PB-Einreichung (B-01/B-02/B-03).
 *
 * Ein Epic darf erst auf den Ballot, wenn es im Einheitsformat vorliegt:
 * Problem, MVP-Schnitt, Kosten-bis-MVP (eine Zahl > 0), Risiko-Ampel und
 * „wenn nicht finanziert". (Lösung liefert die Hypothese, Abhängigkeiten der
 * Dependency-Graph — beide separat, hier nicht geprüft.)
 *
 * Rein, kein I/O.
 */

export const RISK_RATINGS = ["hoch", "mittel", "gering"] as const;
export type RiskRating = (typeof RISK_RATINGS)[number];

export interface SubmissionFields {
  problemStatement: string | null;
  mvpCut: string | null;
  costToMvp: number | null;
  riskRating: string | null;
  ifNotFunded: string | null;
}

export type SubmissionField = keyof SubmissionFields;

/** Die Pflichtfelder in Reihenfolge — für „was fehlt noch". */
export const REQUIRED_SUBMISSION_FIELDS: readonly SubmissionField[] = [
  "problemStatement",
  "mvpCut",
  "costToMvp",
  "riskRating",
  "ifNotFunded",
];

function isFilled(field: SubmissionField, e: SubmissionFields): boolean {
  switch (field) {
    case "costToMvp":
      return e.costToMvp != null && e.costToMvp > 0;
    case "riskRating":
      return e.riskRating != null && (RISK_RATINGS as readonly string[]).includes(e.riskRating);
    default:
      return typeof e[field] === "string" && (e[field] as string).trim() !== "";
  }
}

/** Die noch fehlenden/ungültigen Pflichtfelder (leer = einreichungsbereit). */
export function missingSubmissionFields(e: SubmissionFields): SubmissionField[] {
  return REQUIRED_SUBMISSION_FIELDS.filter((f) => !isFilled(f, e));
}

/** True, wenn alle Pflichtfelder gültig belegt sind. */
export function isSubmissionReady(e: SubmissionFields): boolean {
  return missingSubmissionFields(e).length === 0;
}
