import { describe, it, expect } from "vitest";
import {
  deriveNextSteps,
  goalKpiProgress,
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
      dimensions: [{ key: "teams", label: "Teams", ist: 0, soll: 2, progress: 0 }],
    };
    const adoption: PracticeAdoption = {
      hasTarget: true,
      signals: [{ key: "piObjectives", label: "PI-Ziele", value: 0, detail: "0/2" }],
    };
    const keys = deriveNextSteps(gap, adoption).map((s) => s.key);
    expect(keys).toEqual(["struct-teams", "prac-piObjectives"]);
  });
});

describe("goalKpiProgress", () => {
  it("returns 0 for a goal with no KPIs", () => {
    expect(goalKpiProgress([])).toBe(0);
  });

  it("uses the baseline→target band, clamped to 0..1", () => {
    // baseline 0, target 10, current 5 → 0.5
    expect(goalKpiProgress([{ baseline: 0, target: 10, current: 5 }])).toBeCloseTo(0.5);
    // baseline 20, target 100, current 60 → (60-20)/(100-20) = 0.5
    expect(goalKpiProgress([{ baseline: 20, target: 100, current: 60 }])).toBeCloseTo(0.5);
    // overshoot clamps to 1
    expect(goalKpiProgress([{ baseline: 0, target: 10, current: 999 }])).toBe(1);
    // below baseline clamps to 0
    expect(goalKpiProgress([{ baseline: 50, target: 100, current: 10 }])).toBe(0);
  });

  it("averages across multiple KPIs", () => {
    expect(
      goalKpiProgress([
        { baseline: 0, target: 10, current: 10 }, // 1
        { baseline: 0, target: 10, current: 0 }, // 0
      ]),
    ).toBeCloseTo(0.5);
  });

  it("treats a null current as no progress (baseline)", () => {
    expect(goalKpiProgress([{ baseline: 0, target: 10, current: null }])).toBe(0);
  });
});
