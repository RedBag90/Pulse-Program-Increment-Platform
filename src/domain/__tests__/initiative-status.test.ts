import { describe, it, expect } from "vitest";
import { canQaTransition, decisionTarget } from "@/domain/initiative-status";

describe("canQaTransition", () => {
  it("allows submitting a draft for review", () => {
    expect(canQaTransition("draft", "in_review")).toBe(true);
  });

  it("allows approving an in-review initiative", () => {
    expect(canQaTransition("in_review", "approved")).toBe(true);
  });

  it("allows sending an in-review initiative back to draft", () => {
    expect(canQaTransition("in_review", "draft")).toBe(true);
  });

  it("forbids skipping review (draft → approved)", () => {
    expect(canQaTransition("draft", "approved")).toBe(false);
  });

  it("forbids transitions out of approved", () => {
    expect(canQaTransition("approved", "in_review")).toBe(false);
    expect(canQaTransition("approved", "draft")).toBe(false);
  });

  it("forbids no-op transitions", () => {
    expect(canQaTransition("draft", "draft")).toBe(false);
    expect(canQaTransition("in_review", "in_review")).toBe(false);
  });

  it("returns false for statuses outside the QA gate", () => {
    expect(canQaTransition("in_progress", "in_review")).toBe(false);
    expect(canQaTransition("draft", "completed")).toBe(false);
  });
});

describe("decisionTarget", () => {
  it("maps approve → approved and reject → draft", () => {
    expect(decisionTarget("approve")).toBe("approved");
    expect(decisionTarget("reject")).toBe("draft");
  });
});
