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
      dimensions: [{ key: "arts", labelKey: "structure.arts", ist: 1, soll: 3, progress: 1 / 3 }],
    };
    const steps = deriveNextSteps(gap, noAdoption);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      key: "struct-arts",
      href: "/transformation/art-starten",
      titleKey: "work.nextStep.createMore",
      // Die Zahl steht als Wert im Satz, nicht im Satz selbst — sonst wäre
      // der fehlende Rest auf Englisch unübersetzbar (ADR-0024, Regel 2).
      titleValues: { missing: 2 },
      titleKeyValues: { what: "structure.arts" },
    });
  });

  it("ignores dimensions that have no target or are already met", () => {
    const gap: StructureGap = {
      ...emptyGap,
      dimensions: [
        {
          key: "valueStreams",
          labelKey: "structure.valueStreams",
          ist: 2,
          soll: null,
          progress: 1,
        },
        { key: "teams", labelKey: "structure.teams", ist: 5, soll: 5, progress: 1 },
      ],
    };
    expect(deriveNextSteps(gap, noAdoption)).toEqual([]);
  });

  it("surfaces under-adopted practices (below 50%) with a fix link", () => {
    const adoption: PracticeAdoption = {
      hasTarget: true,
      signals: [
        {
          key: "wsjf",
          labelKey: "practices.wsjf",
          value: 0.2,
          detailKey: "work.adoption.featuresScored",
          detailValues: { n: 1, total: 5 },
        },
        {
          key: "featureQs",
          labelKey: "practices.featureQs",
          value: 0.9,
          detailKey: "work.adoption.featuresApproved",
          detailValues: { n: 9, total: 10 },
        },
      ],
    };
    const steps = deriveNextSteps(emptyGap, adoption);
    expect(steps).toHaveLength(1); // only wsjf (0.2 < 0.5); featureQs (0.9) is fine
    expect(steps[0]).toMatchObject({ key: "prac-wsjf", href: "/structure" });
  });

  it("orders structure shortfalls before practice gaps (sanity)", () => {
    const gap: StructureGap = {
      ...emptyGap,
      dimensions: [{ key: "arts", labelKey: "structure.arts", ist: 0, soll: 2, progress: 0 }],
    };
    const adoption: PracticeAdoption = {
      hasTarget: true,
      signals: [
        {
          key: "wsjf",
          labelKey: "practices.wsjf",
          value: 0,
          detailKey: "work.adoption.featuresScored",
          detailValues: { n: 0, total: 2 },
        },
      ],
    };
    const keys = deriveNextSteps(gap, adoption).map((s) => s.key);
    expect(keys).toEqual(["struct-arts", "prac-wsjf"]);
  });
});
