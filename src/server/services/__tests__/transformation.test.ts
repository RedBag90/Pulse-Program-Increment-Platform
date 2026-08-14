import { describe, it, expect } from "vitest";
import {
  deriveNextSteps,
  type StructureGap,
  type PracticeAdoption,
} from "@/server/services/transformation";

const emptyGap: StructureGap = {
  hasTarget: true,
  targetDate: null,
  dimensions: [],
  overallProgress: 1,
};
const noAdoption: PracticeAdoption = { hasTarget: true, signals: [] };

describe("deriveNextSteps", () => {
  it("returns no steps when there is no shortfall", () => {
    expect(deriveNextSteps(emptyGap, noAdoption)).toEqual([]);
  });

  it("proposes creating the missing count for a structure dimension below target", () => {
    const gap: StructureGap = {
      ...emptyGap,
      dimensions: [{ key: "arts", label: "ARTs", ist: 1, soll: 3, progress: 1 / 3 }],
    };
    const steps = deriveNextSteps(gap, noAdoption);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ key: "struct-arts", href: "/transformation/art-starten" });
    expect(steps[0]?.title).toContain("2"); // 3 - 1
  });

  it("ignores dimensions that have no target or are already met", () => {
    const gap: StructureGap = {
      ...emptyGap,
      dimensions: [
        { key: "valueStreams", label: "Wertströme", ist: 2, soll: null, progress: 1 },
        { key: "teams", label: "Teams", ist: 5, soll: 5, progress: 1 },
      ],
    };
    expect(deriveNextSteps(gap, noAdoption)).toEqual([]);
  });

  it("surfaces under-adopted practices (below 50%) with a fix link", () => {
    const adoption: PracticeAdoption = {
      hasTarget: true,
      signals: [
        { key: "wsjf", label: "WSJF", value: 0.2, detail: "1/5" },
        { key: "featureQs", label: "Feature-QS", value: 0.9, detail: "9/10" },
      ],
    };
    const steps = deriveNextSteps(emptyGap, adoption);
    expect(steps).toHaveLength(1); // only wsjf (0.2 < 0.5); featureQs (0.9) is fine
    expect(steps[0]).toMatchObject({ key: "prac-wsjf", href: "/structure?tab=arts" });
  });

  it("orders structure shortfalls before practice gaps (sanity)", () => {
    const gap: StructureGap = {
      ...emptyGap,
      dimensions: [{ key: "arts", label: "ARTs", ist: 0, soll: 2, progress: 0 }],
    };
    const adoption: PracticeAdoption = {
      hasTarget: true,
      signals: [{ key: "wsjf", label: "WSJF", value: 0, detail: "0/2" }],
    };
    const keys = deriveNextSteps(gap, adoption).map((s) => s.key);
    expect(keys).toEqual(["struct-arts", "prac-wsjf"]);
  });
});
