import { describe, it, expect } from "vitest";
import {
  isSubmissionReady,
  missingSubmissionFields,
  type SubmissionFields,
} from "@/modules/work/domain/submission";

const READY: SubmissionFields = {
  problemStatement: "Kunden warten zu lang auf Antworten.",
  mvpCut: "Self-Service-Statusabfrage online.",
  costToMvp: 600_000,
  riskRating: "mittel",
  ifNotFunded: "Support-Last bleibt hoch.",
};

describe("isSubmissionReady", () => {
  it("vollständige Einreichung ist bereit", () => {
    expect(isSubmissionReady(READY)).toBe(true);
    expect(missingSubmissionFields(READY)).toEqual([]);
  });

  it("fehlendes Problem + MVP-Schnitt werden gemeldet", () => {
    expect(missingSubmissionFields({ ...READY, problemStatement: "  ", mvpCut: null })).toEqual([
      "problemStatement",
      "mvpCut",
    ]);
  });

  it("Kosten müssen eine Zahl > 0 sein", () => {
    expect(isSubmissionReady({ ...READY, costToMvp: null })).toBe(false);
    expect(isSubmissionReady({ ...READY, costToMvp: 0 })).toBe(false);
  });

  it("Risiko muss eine gültige Ampel sein", () => {
    expect(isSubmissionReady({ ...READY, riskRating: "unbekannt" })).toBe(false);
    expect(isSubmissionReady({ ...READY, riskRating: "gering" })).toBe(true);
  });
});
