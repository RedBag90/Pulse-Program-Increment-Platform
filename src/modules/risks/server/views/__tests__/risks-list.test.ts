import { describe, it, expect } from "vitest";
import { buildRisksListModel, type RiskRow } from "@/modules/risks/server/views/risks-list";
import { cellKey } from "@/modules/risks/domain/risk-matrix";

function makeRisk(over: Partial<RiskRow> = {}): RiskRow {
  return {
    id: "r1",
    riskNumber: 1,
    title: "A risk",
    description: null,
    probability: "high",
    impact: "high",
    category: "technical",
    targetResolutionDate: null,
    reviewStatus: "documented",
    roamStatus: "open",
    ownerId: null,
    raisedBy: "u1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    assessments: [],
    epicLinks: [],
    mitigations: [],
    ...over,
  };
}

const prefix = "R-";
const userLabels = { u1: "Alice", u2: "Bob" };

describe("buildRisksListModel", () => {
  it("formats display numbers and shows Vorschlag (null) for suggestions", () => {
    const m = buildRisksListModel({
      risks: [
        makeRisk({ id: "a", riskNumber: 7 }),
        makeRisk({ id: "b", riskNumber: null, reviewStatus: "suggested" }),
      ],
      prefix,
      userLabels,
    });
    expect(m.rows[0]!.displayNumber).toBe("R-007");
    expect(m.suggestions).toHaveLength(1);
    expect(m.suggestions[0]!.displayNumber).toBeNull();
  });

  it("aggregates the ROAM funnel over documented risks only", () => {
    const m = buildRisksListModel({
      risks: [
        makeRisk({ id: "a", roamStatus: "mitigated" }),
        makeRisk({ id: "b", roamStatus: "owned" }),
        makeRisk({ id: "c", reviewStatus: "suggested", roamStatus: "owned" }),
      ],
      prefix,
      userLabels,
    });
    expect(m.roamFunnel.mitigated).toBe(1);
    expect(m.roamFunnel.owned).toBe(1); // the suggested one is excluded
    expect(m.roamFunnel.open).toBe(0);
  });

  it("plots documented scored risks at their current cell; unscored go to the tray", () => {
    const m = buildRisksListModel({
      risks: [
        makeRisk({ id: "scored", probability: "high", impact: "high" }),
        makeRisk({ id: "unscored", probability: null, impact: null }),
      ],
      prefix,
      userLabels,
    });
    const target = m.matrix.cells.find((c) => c.key === cellKey("high", "high"))!;
    expect(target.count).toBe(1);
    expect(m.matrix.plots).toHaveLength(1);
    expect(m.unscored.map((r) => r.id)).toEqual(["unscored"]);
  });

  it("builds a multi-hop plot trail from inherent + reassessments", () => {
    const m = buildRisksListModel({
      risks: [
        makeRisk({
          id: "moved",
          probability: "high",
          impact: "high",
          assessments: [
            { probability: "medium", impact: "high", createdAt: new Date("2026-02-01") },
            { probability: "low", impact: "medium", createdAt: new Date("2026-03-01") },
          ],
        }),
      ],
      prefix,
      userLabels,
    });
    const plot = m.matrix.plots[0]!;
    expect(plot.trail).toHaveLength(3);
    expect(plot.trail[0]).toEqual({ probability: "high", impact: "high" });
    expect(plot.trail[2]).toEqual({ probability: "low", impact: "medium" });
    // current cell is the last hop
    const current = m.matrix.cells.find((c) => c.key === cellKey("low", "medium"))!;
    expect(current.count).toBe(1);
  });

  it("flags overdue (past target, not resolved) and resolves owner labels", () => {
    const past = new Date(Date.now() - 86400_000);
    const m = buildRisksListModel({
      risks: [
        makeRisk({ id: "od", targetResolutionDate: past, roamStatus: "open", ownerId: "u2" }),
        makeRisk({ id: "done", targetResolutionDate: past, roamStatus: "resolved" }),
      ],
      prefix,
      userLabels,
    });
    const od = m.rows.find((r) => r.id === "od")!;
    expect(od.isOverdue).toBe(true);
    expect(od.ownerLabel).toBe("Bob");
    expect(m.rows.find((r) => r.id === "done")!.isOverdue).toBe(false);
    expect(m.facets.owners).toEqual([{ id: "u2", label: "Bob" }]);
    expect(m.facets.categories).toEqual(["technical"]);
  });
});
