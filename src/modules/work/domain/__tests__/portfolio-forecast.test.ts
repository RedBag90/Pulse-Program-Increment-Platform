import { describe, it, expect } from "vitest";
import {
  epicMonthlyFlows,
  groupSeriesByEstimatedStage,
  type EpicEconomicsInput,
  type EpicSeries,
} from "@/modules/work/domain/portfolio-economics";
import type { StageTransition } from "@/modules/work/domain/epic-stage-timeline";
import { buildMonthAxis } from "@/modules/core/kernel/domain/calendar";

const axis = buildMonthAxis(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))); // Jan–Apr (4 Monate)
const m = (y: number, mo: number) => new Date(Date.UTC(y, mo - 1, 1));

describe("epicMonthlyFlows — Forecast-Rest zum Ziel (benefitUplift)", () => {
  const input: EpicEconomicsInput = {
    id: "e",
    title: "E",
    costSlices: [],
    oneTimeBenefit: 0,
    recurringBenefit: 0,
    costStart: m(2026, 1),
    goLive: m(2026, 1), // go-live gleich Achsenstart
    kpiRecurringByMonth: [100, 100, 100, 100], // gemessene Run-Rate
    kpiRecurringAtFull: 300, // Plan-Run-Rate @Ziel
  };

  it("füllt nur Zukunftsmonate (> heute, ≥ go-live) mit dem Delta zum Plan", () => {
    const todayIndex = 1; // heute = Feb; Forecast ab März
    const { benefit, benefitUplift } = epicMonthlyFlows(input, axis, todayIndex);
    expect(benefit).toEqual([100, 100, 100, 100]); // gemessene Fortschreibung
    expect(benefitUplift).toEqual([0, 0, 200, 200]); // 300 − 100 ab März
  });

  it("liefert keinen Uplift ohne kpiRecurringAtFull (Business-Case-Fallback ist der Plan)", () => {
    const { kpiRecurringAtFull: _omit, ...noPlan } = input;
    void _omit;
    const { benefitUplift } = epicMonthlyFlows(noPlan, axis, 1);
    expect(benefitUplift).toEqual([0, 0, 0, 0]);
  });
});

describe("groupSeriesByEstimatedStage — zeit-variable Status-Buckets", () => {
  const epic: EpicSeries = {
    id: "e1",
    title: "Epic 1",
    cost: [10, 10, 10, 10],
    benefit: [0, 0, 5, 5],
    benefitUplift: [0, 0, 0, 3],
    net: [-10, -10, -5, -2],
    accCost: [10, 20, 30, 40],
    accBenefit: [0, 0, 5, 13],
    accNet: [-10, -20, -25, -27],
  };
  // L0 bis Feb, danach L3 (Backlog) ab März.
  const timelines = new Map<string, StageTransition[]>([
    [
      "e1",
      [
        { gate: "L0", month: m(2026, 1) },
        { gate: "L3", month: m(2026, 3) },
      ],
    ],
  ]);
  const confirmed = new Map([["e1", true]]);

  it("routet Monatsflüsse in den Status des jeweiligen Monats und kumuliert je Bucket neu", () => {
    const groups = groupSeriesByEstimatedStage([epic], timelines, axis, confirmed);
    const byId = new Map(groups.map((g) => [g.id, g]));

    const l0 = byId.get("status:L0")!;
    expect(l0.cost).toEqual([10, 10, 0, 0]);
    expect(l0.benefit).toEqual([0, 0, 0, 0]);

    const l3 = byId.get("status:L3")!;
    expect(l3.cost).toEqual([0, 0, 10, 10]);
    expect(l3.benefit).toEqual([0, 0, 5, 5]);
    expect(l3.benefitUplift).toEqual([0, 0, 0, 3]);
    // accBenefit über den Gesamt-Benefit (benefit + uplift) neu kumuliert.
    expect(l3.accBenefit).toEqual([0, 0, 5, 13]);
    expect(l3.accCost).toEqual([0, 0, 10, 20]);
    expect(l3.accNet).toEqual([0, 0, -5, -7]);
  });

  it("sortiert Buckets nach Stage-Gate (L0 vor L3)", () => {
    const groups = groupSeriesByEstimatedStage([epic], timelines, axis, confirmed);
    expect(groups.map((g) => g.id)).toEqual(["status:L0", "status:L3"]);
  });

  it("hängt bei veranschlagten (nicht allozierten) Epics `:est` an die Bucket-ID", () => {
    const groups = groupSeriesByEstimatedStage([epic], timelines, axis, new Map([["e1", false]]));
    expect(groups.map((g) => g.id)).toEqual(["status:L0:est", "status:L3:est"]);
  });

  it("haelt ein L5-Epic mit nachlaufendem createdAt ueber die ganze Achse in status:L5", () => {
    // Der L0-Punkt (createdAt) liegt hinter L5 — vor der Ratsche landete der
    // Nutzen ab diesem Monat wieder im L0-Bucket.
    const late = new Map<string, StageTransition[]>([
      [
        "e1",
        [
          { gate: "L5", month: m(2025, 6) },
          { gate: "L0", month: m(2026, 2) },
        ],
      ],
    ]);
    const groups = groupSeriesByEstimatedStage([epic], late, axis, confirmed);
    expect(groups.map((g) => g.id)).toEqual(["status:L5"]);
    expect(groups[0]!.benefit).toEqual([0, 0, 5, 5]);
  });
});
