import { describe, it, expect } from "vitest";
import { buildPlanningModel } from "@/server/views/pi-planning";

describe("buildPlanningModel", () => {
  it("flattens the sprint count and maps features (Decimal→number, epic title)", () => {
    const { pis, features } = buildPlanningModel({
      pis: [
        {
          id: "p1",
          name: "PI 1",
          status: "active",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-31"),
          capacityJobSize: null,
          capacityAmount: null,
          _count: { sprints: 5 },
        },
      ],
      features: [
        {
          id: "f1",
          title: "F1",
          status: "in_progress",
          wsjfComputed: 3.5,
          wsjfJobSize: 8,
          parent: { title: "Epic A" },
          piId: "p1",
        },
        {
          id: "f2",
          title: "F2",
          status: "todo",
          wsjfComputed: null,
          wsjfJobSize: null,
          parent: null,
          piId: null,
        },
      ],
      artBudgetByPeriod: null,
      costPerJobSizePoint: null,
      blockerWindowsByFeature: new Map(),
    });
    expect(pis[0]).toEqual({
      id: "p1",
      name: "PI 1",
      status: "active",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      sprintCount: 5,
    });
    expect(features[0]).toEqual({
      id: "f1",
      title: "F1",
      status: "in_progress",
      wsjf: 3.5,
      epicTitle: "Epic A",
      piId: "p1",
    });
    expect(features[1]).toMatchObject({ wsjf: 0, epicTitle: null, piId: null });
  });

  it("computes per-PI Job-Size demand from features assigned to that PI", () => {
    const { capacity } = buildPlanningModel({
      pis: [
        {
          id: "p1",
          name: "PI 1",
          status: "planned",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-04-01"),
          capacityJobSize: 20,
          capacityAmount: null,
          _count: { sprints: 0 },
        },
      ],
      features: [
        {
          id: "f1",
          title: "F1",
          status: "approved",
          wsjfComputed: 0,
          wsjfJobSize: 8,
          parent: null,
          piId: "p1",
        },
        {
          id: "f2",
          title: "F2",
          status: "approved",
          wsjfComputed: 0,
          wsjfJobSize: 13,
          parent: null,
          piId: "p1",
        },
      ],
      artBudgetByPeriod: null,
      costPerJobSizePoint: null,
      blockerWindowsByFeature: new Map(),
    });
    expect(capacity["p1"]).toMatchObject({
      jobSizeDemand: 21,
      jobSizeCapacity: 20,
      band: "over",
    });
  });

  it("flags a violation when the current PI starts before the latest blocker end", () => {
    const { blockers } = buildPlanningModel({
      pis: [
        {
          id: "p1",
          name: "PI 2026.1",
          status: "planned",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-31"),
          capacityJobSize: null,
          capacityAmount: null,
          _count: { sprints: 0 },
        },
        {
          id: "p2",
          name: "PI 2026.2",
          status: "planned",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
          capacityJobSize: null,
          capacityAmount: null,
          _count: { sprints: 0 },
        },
      ],
      features: [
        {
          id: "f1",
          title: "F1",
          status: "approved",
          wsjfComputed: 0,
          wsjfJobSize: 5,
          parent: null,
          piId: "p1", // assigned to early PI…
        },
      ],
      artBudgetByPeriod: null,
      costPerJobSizePoint: null,
      blockerWindowsByFeature: new Map([
        [
          "f1",
          [{ blockerId: "b1", blockerTitle: "Blocker A", blockerEndDate: new Date("2026-03-15") }],
        ],
      ]),
    });
    expect(blockers["f1"]).toMatchObject({
      violates: true,
      earliestPiId: "p2",
      earliestPiName: "PI 2026.2",
    });
  });

  it("uses the ART budget prorated to the PI when no explicit € override is set", () => {
    const { capacity } = buildPlanningModel({
      pis: [
        {
          id: "p1",
          name: "PI 1",
          status: "planned",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-04-01"),
          capacityJobSize: null,
          capacityAmount: null,
          _count: { sprints: 0 },
        },
      ],
      features: [
        {
          id: "f1",
          title: "F1",
          status: "approved",
          wsjfComputed: 0,
          wsjfJobSize: 10,
          parent: null,
          piId: "p1",
        },
      ],
      artBudgetByPeriod: { "2026-H1": 800_000 },
      costPerJobSizePoint: 8_000,
      blockerWindowsByFeature: new Map(),
    });
    expect(capacity["p1"]!.amountSource).toBe("prorated");
    expect(capacity["p1"]!.amountDemand).toBe(80_000);
    // 800k * 90/181 ≈ 397.79k — demand 80k → ratio ≈ 20% → ok.
    expect(capacity["p1"]!.band).toBe("ok");
  });
});
