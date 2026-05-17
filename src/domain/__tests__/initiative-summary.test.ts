import { describe, it, expect } from "vitest";
import { buildInitiativeSummary, STALE_AFTER_DAYS } from "@/domain/initiative-summary";

const NOW = new Date("2026-05-17T12:00:00Z");

describe("buildInitiativeSummary", () => {
  it("always opens with the stage and a humanised status", () => {
    const s = buildInitiativeSummary({
      stageGate: "L3",
      status: "in_progress",
      childCount: 0,
      completedChildCount: 0,
      approvedAt: null,
      updatedAt: NOW,
      now: NOW,
    });
    expect(s).toBe("Stage L3 — in Umsetzung");
  });

  it("reports child completion when there are children", () => {
    const s = buildInitiativeSummary({
      stageGate: "L4",
      status: "in_progress",
      childCount: 4,
      completedChildCount: 1,
      approvedAt: null,
      updatedAt: NOW,
      now: NOW,
    });
    expect(s).toContain("1 von 4 untergeordneten Initiativen abgeschlossen");
  });

  it("omits the child clause when there are no children", () => {
    const s = buildInitiativeSummary({
      stageGate: "L0",
      status: "draft",
      childCount: 0,
      completedChildCount: 0,
      approvedAt: null,
      updatedAt: NOW,
      now: NOW,
    });
    expect(s).not.toContain("untergeordneten");
  });

  it("flags an Epic that has been untouched past the stale threshold", () => {
    const stale = new Date(NOW.getTime() - (STALE_AFTER_DAYS + 6) * 86_400_000);
    const s = buildInitiativeSummary({
      stageGate: "L3",
      status: "in_progress",
      childCount: 0,
      completedChildCount: 0,
      approvedAt: null,
      updatedAt: stale,
      now: NOW,
    });
    expect(s).toContain(`seit ${STALE_AFTER_DAYS + 6} Tagen unverändert`);
  });

  it("does not flag a recently updated Epic as stale", () => {
    const s = buildInitiativeSummary({
      stageGate: "L3",
      status: "in_progress",
      childCount: 0,
      completedChildCount: 0,
      approvedAt: null,
      updatedAt: new Date(NOW.getTime() - 2 * 86_400_000),
      now: NOW,
    });
    expect(s).not.toContain("unverändert");
  });

  it("notes approval once the Epic has an approval timestamp", () => {
    const s = buildInitiativeSummary({
      stageGate: "L3",
      status: "approved",
      childCount: 0,
      completedChildCount: 0,
      approvedAt: NOW,
      updatedAt: NOW,
      now: NOW,
    });
    expect(s).toContain("freigegeben");
  });
});
