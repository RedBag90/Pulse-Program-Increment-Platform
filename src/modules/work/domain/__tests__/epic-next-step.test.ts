import { describe, it, expect } from "vitest";
import { epicNextStep, type EpicNextStepInput } from "@/modules/work/domain/epic-next-step";

const base = (over: Partial<EpicNextStepInput> = {}): EpicNextStepInput => ({
  epicId: "epic-1",
  stageGate: "L0",
  subStage: null,
  approvalPhase: null,
  hasHypothesis: false,
  hasBusinessCase: false,
  budgetAllocated: false,
  impactRecognizedAt: null,
  childFeatureStats: { total: 0, completed: 0 },
  ...over,
});

describe("epicNextStep", () => {
  it("L0 ohne Hypothese-Inhalt → Benefit Hypothese ausarbeiten", () => {
    const step = epicNextStep(base());
    expect(step?.title).toBe("Benefit Hypothese ausarbeiten");
    expect(step?.cta).toEqual({
      kind: "link",
      label: "Zur Hypothese",
      href: "/portfolio/epics/epic-1?tab=benefit-hypothesis",
    });
  });

  it("L0 mit Hypothese-Inhalt aber noch draft → Hypothese einreichen", () => {
    const step = epicNextStep(base({ hasHypothesis: true, approvalPhase: "draft" }));
    expect(step?.title).toBe("Hypothese zur Entscheidung einreichen");
  });

  it("L0 + hypothesis_review → Warte-Hinweis auf Portfolio Manager + Link zu Freigaben", () => {
    const step = epicNextStep(base({ hasHypothesis: true, approvalPhase: "hypothesis_review" }));
    expect(step?.title).toBe("Auf Portfolio-Manager-Entscheidung warten");
    expect(step?.cta).toEqual({
      kind: "link",
      label: "Zu meinen Freigaben",
      href: "/my-approvals",
    });
  });

  it("L1 → Business Case ausarbeiten", () => {
    const step = epicNextStep(base({ stageGate: "L1", hasHypothesis: true }));
    expect(step?.title).toBe("Business Case ausarbeiten");
    expect(step?.cta).toMatchObject({
      kind: "link",
      href: expect.stringContaining("business-case"),
    });
  });

  it("L1 + hasBusinessCase + approvalPhase business_case → BC einreichen (resilient)", () => {
    const step = epicNextStep(
      base({
        stageGate: "L1",
        hasHypothesis: true,
        hasBusinessCase: true,
        approvalPhase: "business_case",
      }),
    );
    expect(step?.title).toBe("Business Case einreichen");
  });

  it("L1 + approvalPhase stakeholder_review → Auf Stakeholder-Freigabe warten (resilient)", () => {
    const step = epicNextStep(
      base({
        stageGate: "L1",
        hasHypothesis: true,
        hasBusinessCase: true,
        approvalPhase: "stakeholder_review",
      }),
    );
    expect(step?.title).toBe("Auf Stakeholder-Freigabe warten");
  });

  it("L1 + approvalPhase approved → Budget allozieren (resilient)", () => {
    const step = epicNextStep(
      base({
        stageGate: "L1",
        hasHypothesis: true,
        hasBusinessCase: true,
        approvalPhase: "approved",
      }),
    );
    expect(step?.title).toBe("Budget allozieren");
  });

  it("L2 ohne BC-Inhalt → BC ausarbeiten", () => {
    const step = epicNextStep(base({ stageGate: "L2", approvalPhase: "business_case" }));
    expect(step?.title).toBe("Business Case ausarbeiten");
  });

  it("L2 mit BC-Inhalt → BC einreichen", () => {
    const step = epicNextStep(
      base({
        stageGate: "L2",
        approvalPhase: "business_case",
        hasBusinessCase: true,
      }),
    );
    expect(step?.title).toBe("Business Case einreichen");
  });

  it("L2 + stakeholder_review → Warte-Hinweis", () => {
    const step = epicNextStep(
      base({
        stageGate: "L2",
        approvalPhase: "stakeholder_review",
        hasBusinessCase: true,
      }),
    );
    expect(step?.title).toBe("Auf Stakeholder-Freigabe warten");
  });

  it("L3 / L3.1 ohne Budget → Budget allozieren mit Link auf /budgeting", () => {
    const step = epicNextStep(
      base({ stageGate: "L3", subStage: "L3.1", approvalPhase: "approved" }),
    );
    expect(step?.title).toBe("Budget allozieren");
    expect(step?.cta).toEqual({ kind: "link", label: "Zum Controlling", href: "/budgeting" });
  });

  it("L3 / L3.1 mit Budget → Investition abnehmen lassen (L3.2)", () => {
    const step = epicNextStep(
      base({
        stageGate: "L3",
        subStage: "L3.1",
        approvalPhase: "approved",
        budgetAllocated: true,
      }),
    );
    expect(step?.title).toBe("Investition abnehmen lassen");
    expect(step?.cta).toEqual({ kind: "gate-request", to: "L3.2" });
  });

  it("L3 / L3.2 → Erstes Feature starten", () => {
    const step = epicNextStep(base({ stageGate: "L3", subStage: "L3.2", budgetAllocated: true }));
    expect(step?.title).toBe("Erstes Feature starten");
    expect(step?.cta).toMatchObject({ kind: "link", href: expect.stringContaining("breakdown") });
  });

  it("L4 / L4.1 → Features abschließen mit Fortschritts-Counter", () => {
    const step = epicNextStep(
      base({
        stageGate: "L4",
        subStage: "L4.1",
        childFeatureStats: { total: 5, completed: 2 },
      }),
    );
    expect(step?.title).toBe("Features abschließen (2/5)");
  });

  it("L4 / L4.2 → Impact bestätigen lassen (Gate-Antrag nach L5)", () => {
    const step = epicNextStep(
      base({
        stageGate: "L4",
        subStage: "L4.2",
        childFeatureStats: { total: 3, completed: 3 },
      }),
    );
    expect(step?.title).toBe("Impact bestätigen lassen");
    // Kein eigener Impact-Dialog mehr: der Wechsel auf L5 wird beantragt und
    // vom Controlling abgenommen wie jeder andere Reifegrad-Wechsel.
    expect(step?.cta).toEqual({ kind: "gate-request", to: "L5" });
  });

  it("L5 → null (Endstand)", () => {
    const step = epicNextStep(base({ stageGate: "L5", impactRecognizedAt: new Date() }));
    expect(step).toBeNull();
  });

  it("impactRecognizedAt ≠ null überstimmt jeden anderen Stage Gate", () => {
    const step = epicNextStep(
      base({ stageGate: "L4", subStage: "L4.2", impactRecognizedAt: new Date() }),
    );
    expect(step).toBeNull();
  });
});
