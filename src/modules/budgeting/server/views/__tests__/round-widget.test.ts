import { describe, it, expect } from "vitest";
import { buildRoundWidget } from "@/modules/budgeting/server/views/round-widget";

const base = {
  cycleKey: "2026-H1",
  status: "running" as const,
  poolTotal: 1_000_000,
  reserveAmount: null,
  groupCount: 3,
  ballotCount: 4,
  decidedCount: 1,
};

describe("buildRoundWidget", () => {
  it("gibt null zurück, wenn es keine Runde gibt", () => {
    expect(buildRoundWidget({ ...base, status: null })).toBeNull();
  });

  it("leitet Status-Label und Entscheidungs-Fortschritt ab", () => {
    const w = buildRoundWidget(base)!;
    expect(w.statusLabel).toBe("läuft");
    expect(w.decidedFraction).toBeCloseTo(0.25);
    expect(w.href).toBe("/budgeting/rounds");
  });

  it("zeigt Reserve nur im Status closed", () => {
    expect(buildRoundWidget({ ...base, status: "running", reserveAmount: 50_000 })!.reserve).toBeNull();
    expect(buildRoundWidget({ ...base, status: "closed", reserveAmount: 50_000 })!.reserve).toBe(50_000);
  });

  it("Fortschritt 0 bei leerem Ballot (keine Division durch 0)", () => {
    const w = buildRoundWidget({ ...base, ballotCount: 0, decidedCount: 0 })!;
    expect(w.decidedFraction).toBe(0);
  });

  it("deckelt den Fortschritt bei 1", () => {
    const w = buildRoundWidget({ ...base, ballotCount: 2, decidedCount: 5 })!;
    expect(w.decidedFraction).toBe(1);
  });
});
