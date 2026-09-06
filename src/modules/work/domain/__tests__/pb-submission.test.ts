import { describe, it, expect } from "vitest";
import {
  derivePbInfo,
  isPbEligible,
  pbSourceKind,
  resolveEpicClass,
  isEpicClass,
  type PbSource,
} from "@/modules/work/domain/pb-submission";

const HYPOTHESIS = {
  current: {
    measuresHypothesis: "Self-Service-Portal",
    changeFromBaseline: "von manuell zu automatisiert",
    businessOutcomes: ["Ticketvolumen −30 %", "  "],
    leadingIndicators: ["Portal-Logins"],
    risks: ["Adoption unklar"],
  },
};

const BUSINESS_CASE = {
  current: {
    initiativeDescription: "Kundenportal ausbauen",
    businessOutcomeHypothesis: "NPS +10",
    inScope: "Login, Self-Service",
    outOfScope: "Native App",
    whatYouNeedToBelieve: "Adoption > 40 %",
    costSlices: [{ amount: 120000 }, { amount: 80000 }],
  },
};

const base: PbSource = {
  businessCase: null,
  benefitHypothesis: null,
  businessCaseApprovedAt: null,
  hypothesisApprovedAt: null,
};

describe("isPbEligible / pbSourceKind", () => {
  it("none when no artefact is approved", () => {
    expect(isPbEligible(base)).toBe(false);
    expect(pbSourceKind(base)).toBe("none");
  });

  it("approved LBC wins over an approved hypothesis", () => {
    const e = { businessCaseApprovedAt: new Date(), hypothesisApprovedAt: new Date() };
    expect(pbSourceKind(e)).toBe("lbc");
    expect(isPbEligible(e)).toBe(true);
  });

  it("eine freigegebene Hypothese allein reicht **nicht**", () => {
    // Bis September 2026 kam dieses Epic auf die PB-Liste und bekam einen
    // Pauschalbetrag — das Portfolio budgetierte damit die Erarbeitung des
    // Business Case. Es finanziert die Umsetzung.
    const e = { businessCaseApprovedAt: null, hypothesisApprovedAt: new Date() };
    expect(pbSourceKind(e)).toBe("none");
    expect(isPbEligible(e)).toBe(false);
  });
});

describe("derivePbInfo", () => {
  it("none → not ready, cost 0, no rows", () => {
    const info = derivePbInfo(base);
    expect(info).toEqual({ ready: false, source: "none", cost: 0, rows: [] });
  });

  it("approved LBC → cost from cost slices + LBC rows", () => {
    const info = derivePbInfo({
      ...base,
      businessCase: BUSINESS_CASE,
      businessCaseApprovedAt: new Date(),
    });
    expect(info.ready).toBe(true);
    expect(info.source).toBe("lbc");
    expect(info.cost).toBe(200000); // 120k + 80k
    expect(info.rows).toEqual([
      { label: "Beschreibung", value: "Kundenportal ausbauen" },
      { label: "Business-Outcome", value: "NPS +10" },
      { label: "In Scope", value: "Login, Self-Service" },
      { label: "Out of Scope", value: "Native App" },
      { label: "Annahmen", value: "Adoption > 40 %" },
    ]);
  });

  it("nur Hypothese → nicht budgeting-reif, kein Richtwert", () => {
    const info = derivePbInfo({
      ...base,
      benefitHypothesis: HYPOTHESIS,
      hypothesisApprovedAt: new Date(),
    });
    expect(info).toEqual({ ready: false, source: "none", cost: 0, rows: [] });
  });
});

describe("resolveEpicClass — entschieden schlägt erwartet", () => {
  it("nimmt die Entscheidung, wenn es eine gibt", () => {
    expect(resolveEpicClass("portfolio", "art")).toEqual({
      epicClass: "portfolio",
      classSource: "approved",
    });
  });

  it("nimmt die Erwartung, solange nichts entschieden ist", () => {
    // Die 123 Epics, die die Facette bisher nicht fand.
    expect(resolveEpicClass(null, "art")).toEqual({ epicClass: "art", classSource: "intended" });
  });

  it("bleibt ohne beides leer", () => {
    expect(resolveEpicClass(null, null)).toEqual({ epicClass: null, classSource: "none" });
  });

  it("ist eine Einbahnstraße: eine Erwartung überschreibt nie eine Entscheidung", () => {
    for (const decided of ["portfolio", "art"] as const) {
      for (const intended of ["portfolio", "art", null] as const) {
        expect(resolveEpicClass(decided, intended).epicClass).toBe(decided);
      }
    }
  });
});

describe("isEpicClass", () => {
  it("lässt nur die beiden echten Werte durch", () => {
    expect(isEpicClass("portfolio")).toBe(true);
    expect(isEpicClass("art")).toBe(true);
    expect(isEpicClass("Portfolio")).toBe(false);
    expect(isEpicClass(null)).toBe(false);
    expect(isEpicClass(undefined)).toBe(false);
  });
});
