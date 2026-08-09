import { describe, it, expect } from "vitest";
import { buildCascadeTree } from "@/features/portfolio/lib/cascade-tree";
import type { EpicCascadeContribution } from "@/modules/core/goals/domain/goals-rollup";

// steps sind [verknüpftes Ziel … Top-Ziel]; buildCascadeTree dreht sie zur Wurzel.
const step = (goalId: string, planned: number, unit = "€", brokenHere = false) => ({
  goalId,
  goalName: goalId,
  unit,
  planned,
  realized: planned / 2,
  brokenHere,
});

describe("buildCascadeTree", () => {
  it("merged zwei Pfade mit gemeinsamem Top-Ziel und summiert je Ebene", () => {
    // Pfad A: subA (10 %) → top (+100 €). Pfad B: subB (20 %) → top (+300 €).
    const contribs: EpicCascadeContribution[] = [
      {
        linkedGoalId: "subA",
        impactKind: "recurring",
        kpiName: "KPI-A",
        steps: [step("subA", 10, "%"), step("top", 100)],
      },
      {
        linkedGoalId: "subB",
        impactKind: "recurring",
        kpiName: "KPI-B",
        steps: [step("subB", 20, "%"), step("top", 300)],
      },
    ];
    const roots = buildCascadeTree(contribs);
    expect(roots).toHaveLength(1);
    const top = roots[0]!;
    expect(top.goalId).toBe("top");
    expect(top.planned).toBe(400); // 100 + 300
    expect(top.realized).toBe(200);
    expect(top.children.map((c) => c.goalId).sort()).toEqual(["subA", "subB"]);
    const subA = top.children.find((c) => c.goalId === "subA")!;
    expect(subA.planned).toBe(10);
    expect(subA.unit).toBe("%");
    expect(subA.kpiNames).toEqual(["KPI-A"]); // KPI am Blatt annotiert
  });

  it("mehrere Top-Ziele ⇒ mehrere Wurzeln", () => {
    const roots = buildCascadeTree([
      { linkedGoalId: "x", impactKind: "one_time", kpiName: null, steps: [step("x", 5), step("t1", 5)] },
      { linkedGoalId: "y", impactKind: "one_time", kpiName: null, steps: [step("y", 7), step("t2", 7)] },
    ]);
    expect(roots.map((r) => r.goalId).sort()).toEqual(["t1", "t2"]);
  });

  it("brokenHere schlägt auf den Knoten durch", () => {
    const roots = buildCascadeTree([
      {
        linkedGoalId: "sub",
        impactKind: "recurring",
        kpiName: "K",
        steps: [step("sub", 10, "%"), step("top", 0, "€", true)],
      },
    ]);
    expect(roots[0]!.brokenHere).toBe(true);
    expect(roots[0]!.planned).toBe(0);
  });

  it("leere Eingabe ⇒ []", () => {
    expect(buildCascadeTree([])).toEqual([]);
  });
});
