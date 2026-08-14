import { describe, it, expect } from "vitest";
import { aggregateEpicContribution } from "@/modules/core/goals/server/views/epic-goal-contributions";
import type { TopGoalBenefit } from "@/modules/core/goals/domain/goals-rollup";

const benefitU = (
  planned: number,
  realized: number,
  impactKind: string,
  unit: string | null,
): TopGoalBenefit => ({ topGoalId: "g", topGoalName: "Goal", unit, planned, realized, impactKind });

describe("aggregateEpicContribution", () => {
  it("sums same unit within an effect, keeps different units separate", () => {
    const r = aggregateEpicContribution([
      benefitU(100, 60, "recurring", "€"),
      benefitU(50, 20, "recurring", "€"), // same unit → summed
      benefitU(3, 1, "recurring", "%"), // different unit → own entry
      benefitU(200, 200, "one_time", "€"),
    ]);
    expect(r.recurring).toEqual([
      { unit: "€", planned: 150, realized: 80 },
      { unit: "%", planned: 3, realized: 1 },
    ]);
    expect(r.oneTime).toEqual([{ unit: "€", planned: 200, realized: 200 }]);
  });

  it("treats any non-recurring impactKind as one-time; empty → empty buckets", () => {
    expect(aggregateEpicContribution([])).toEqual({ recurring: [], oneTime: [] });
    expect(aggregateEpicContribution([benefitU(10, 5, "one_time", "Stück")])).toEqual({
      recurring: [],
      oneTime: [{ unit: "Stück", planned: 10, realized: 5 }],
    });
  });
});
