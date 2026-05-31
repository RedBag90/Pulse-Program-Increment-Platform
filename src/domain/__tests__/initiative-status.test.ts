import { describe, it, expect } from "vitest";
import {
  canQaTransition,
  decisionTarget,
  canDeliveryTransition,
  DELIVERY_STATUSES,
} from "@/domain/initiative-status";

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

describe("canDeliveryTransition", () => {
  it("starts approved Features (approved → in_progress)", () => {
    expect(canDeliveryTransition("approved", "in_progress")).toBe(true);
  });

  it("allows the pause/resume cycle (in_progress ↔ blocked)", () => {
    expect(canDeliveryTransition("in_progress", "blocked")).toBe(true);
    expect(canDeliveryTransition("blocked", "in_progress")).toBe(true);
  });

  it("completes only from in_progress, never from blocked or approved", () => {
    expect(canDeliveryTransition("in_progress", "completed")).toBe(true);
    expect(canDeliveryTransition("blocked", "completed")).toBe(false);
    expect(canDeliveryTransition("approved", "completed")).toBe(false);
  });

  it("cancels from any live state (approved, in_progress, blocked)", () => {
    expect(canDeliveryTransition("approved", "cancelled")).toBe(true);
    expect(canDeliveryTransition("in_progress", "cancelled")).toBe(true);
    expect(canDeliveryTransition("blocked", "cancelled")).toBe(true);
  });

  it("forbids transitions out of terminal states", () => {
    for (const t of ["completed", "cancelled"] as const) {
      for (const target of DELIVERY_STATUSES) {
        expect(canDeliveryTransition(t, target)).toBe(false);
      }
    }
  });

  it("forbids reaching back into the QS gate (no in_progress → draft)", () => {
    expect(canDeliveryTransition("in_progress", "draft")).toBe(false);
    expect(canDeliveryTransition("in_progress", "in_review")).toBe(false);
    expect(canDeliveryTransition("blocked", "approved")).toBe(false);
  });

  it("forbids no-op transitions", () => {
    for (const s of DELIVERY_STATUSES) {
      expect(canDeliveryTransition(s, s)).toBe(false);
    }
  });
});
