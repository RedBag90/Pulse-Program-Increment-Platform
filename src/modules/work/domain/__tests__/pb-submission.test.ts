import { describe, it, expect } from "vitest";
import {
  derivePbInfo,
  isPbEligible,
  pbSourceKind,
  DEFAULT_HYPOTHESIS_EFFORT,
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

  it("hypothesis-only when only the hypothesis is approved", () => {
    const e = { businessCaseApprovedAt: null, hypothesisApprovedAt: new Date() };
    expect(pbSourceKind(e)).toBe("hypothesis");
  });
});

describe("derivePbInfo", () => {
  it("none → not ready, cost 0, no rows", () => {
    const info = derivePbInfo(base, DEFAULT_HYPOTHESIS_EFFORT);
    expect(info).toEqual({ ready: false, source: "none", cost: 0, rows: [] });
  });

  it("approved LBC → cost from cost slices + LBC rows", () => {
    const info = derivePbInfo(
      { ...base, businessCase: BUSINESS_CASE, businessCaseApprovedAt: new Date() },
      99999,
    );
    expect(info.ready).toBe(true);
    expect(info.source).toBe("lbc");
    expect(info.cost).toBe(200000); // 120k + 80k, NOT the default
    expect(info.rows).toEqual([
      { label: "Beschreibung", value: "Kundenportal ausbauen" },
      { label: "Business-Outcome", value: "NPS +10" },
      { label: "In Scope", value: "Login, Self-Service" },
      { label: "Out of Scope", value: "Native App" },
      { label: "Annahmen", value: "Adoption > 40 %" },
    ]);
  });

  it("hypothesis-only → default effort + hypothesis rows (blank entries dropped)", () => {
    const info = derivePbInfo(
      { ...base, benefitHypothesis: HYPOTHESIS, hypothesisApprovedAt: new Date() },
      70000,
    );
    expect(info.ready).toBe(true);
    expect(info.source).toBe("hypothesis");
    expect(info.cost).toBe(70000);
    expect(info.rows).toEqual([
      { label: "Maßnahmen-Hypothese", value: "Self-Service-Portal" },
      { label: "Veränderung ggü. Baseline", value: "von manuell zu automatisiert" },
      { label: "Business Outcomes", value: "Ticketvolumen −30 %" },
      { label: "Frühindikatoren", value: "Portal-Logins" },
      { label: "Risiken", value: "Adoption unklar" },
    ]);
  });
});
