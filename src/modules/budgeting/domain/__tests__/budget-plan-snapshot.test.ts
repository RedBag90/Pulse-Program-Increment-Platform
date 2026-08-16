import { describe, it, expect } from "vitest";
import {
  buildBudgetPlanSnapshot,
  summarizeSnapshot,
  computeDisplayPeriods,
  UNASSIGNED_VALUE_STREAM_ID,
  type ArtSnapshotInput,
  type BudgetPlanSnapshot,
  type FeatureSnapshotInput,
} from "@/modules/budgeting/domain/budget-plan-snapshot";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function epic(over: Partial<BudgetEpicView>): BudgetEpicView {
  return {
    id: "e",
    title: "E",
    valueStreamId: null,
    valueStream: null,
    isHypothesisOnly: false,
    costSlices: [],
    hypothesisBudget: 0,
    startKey: "2026-H1",
    allocations: {},
    priority: 0,
    ...over,
  };
}

function feature(over: Partial<FeatureSnapshotInput>): FeatureSnapshotInput {
  return {
    featureId: "f",
    parentEpicId: "e1",
    title: "F",
    status: "approved",
    artId: "a1",
    artName: "ART 1",
    wsjfJobSize: 5,
    piId: "p1",
    piName: "PI 1",
    piStartDate: utc("2026-02-01"),
    piEndDate: utc("2026-04-30"),
    ...over,
  };
}

describe("buildBudgetPlanSnapshot — order, cells, roll-ups", () => {
  const baseInputs = {
    cycleKey: "2026-H1",
    capturedAt: utc("2026-01-15"),
    pool: { "2026-H1": 1_000_000, "2026-H2": 1_000_000 },
    artRows: [] as ArtSnapshotInput[],
    features: [] as FeatureSnapshotInput[],
  };

  it("orders Epics by ascending priority and preserves input order on ties", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [
        epic({ id: "a", priority: 3 }),
        epic({ id: "b", priority: 1 }),
        epic({ id: "c", priority: 1 }),
        epic({ id: "d", priority: 2 }),
      ],
    });
    expect(s.epics.map((e) => e.epicId)).toEqual(["b", "c", "d", "a"]);
  });

  it("exposes cycleBudget as allocations[cycleKey] and total across all halves", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [
        epic({
          id: "e1",
          allocations: { "2026-H1": 120_000, "2026-H2": 150_000, "2027-H1": 80_000 },
        }),
      ],
    });
    expect(s.epics[0]!.cycleBudget).toBe(120_000);
    expect(s.epics[0]!.total).toBe(350_000);
  });

  it("returns cycleBudget = 0 when no allocation exists in that half-year", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [epic({ id: "e1", allocations: { "2026-H2": 50_000 } })],
    });
    expect(s.epics[0]!.cycleBudget).toBe(0);
  });

  it("lists only the half-year keys with data (no zero-padding)", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      pool: {}, // pool is empty for this test so it doesn't contribute keys
      epics: [epic({ id: "e1", allocations: { "2026-H1": 100, "2027-H2": 50 } })],
      artRows: [{ artId: "a1", name: "ART 1", budgetByPeriod: { "2026-H2": 200 } }],
    });
    expect(s.periods.map((p) => p.key)).toEqual(["2026-H1", "2026-H2", "2027-H2"]);
  });

  it("rolls up Value Streams; Epics without a VS land in the synthetic bucket", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [
        epic({
          id: "e1",
          valueStreamId: "vs1",
          valueStream: "Retail",
          allocations: { "2026-H1": 60_000 },
        }),
        epic({
          id: "e2",
          valueStreamId: "vs1",
          valueStream: "Retail",
          allocations: { "2026-H1": 40_000, "2026-H2": 30_000 },
        }),
        epic({
          id: "e3",
          valueStreamId: null,
          valueStream: null,
          allocations: { "2026-H1": 10_000 },
        }),
      ],
    });
    const retail = s.valueStreams.find((v) => v.valueStreamId === "vs1");
    expect(retail).toBeDefined();
    expect(retail!.byPeriod).toEqual({ "2026-H1": 100_000, "2026-H2": 30_000 });
    expect(retail!.total).toBe(130_000);

    const unassigned = s.valueStreams.find((v) => v.valueStreamId === UNASSIGNED_VALUE_STREAM_ID);
    expect(unassigned).toBeDefined();
    expect(unassigned!.total).toBe(10_000);
  });

  it("attaches only Features whose PI start lies inside the captured cycle", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [epic({ id: "e1", allocations: { "2026-H1": 100_000 } })],
      features: [
        feature({ featureId: "f-in", piStartDate: utc("2026-02-01") }),
        feature({ featureId: "f-out", piStartDate: utc("2026-08-01") }),
      ],
    });
    expect(s.epics[0]!.cycleFeatures.map((f) => f.featureId)).toEqual(["f-in"]);
  });

  it("freezes ART budgetByPeriod and computes loadByPeriod across all periods (not only cycle)", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [epic({ id: "e1", allocations: { "2026-H1": 100_000 } })],
      artRows: [
        { artId: "a1", name: "ART 1", budgetByPeriod: { "2026-H1": 250_000, "2026-H2": 300_000 } },
      ],
      features: [
        feature({ featureId: "f1", piStartDate: utc("2026-02-01"), wsjfJobSize: 8 }),
        feature({ featureId: "f2", piStartDate: utc("2026-08-01"), wsjfJobSize: 13 }),
      ],
    });
    const art = s.arts.find((a) => a.artId === "a1")!;
    expect(art.budgetByPeriod).toEqual({ "2026-H1": 250_000, "2026-H2": 300_000 });
    expect(art.loadByPeriod).toEqual({
      "2026-H1": { featureCount: 1, jobSizeSum: 8 },
      "2026-H2": { featureCount: 1, jobSizeSum: 13 },
    });
  });

  it("buckets Epics without a Value Stream under the canonical __none__ key", () => {
    expect(UNASSIGNED_VALUE_STREAM_ID).toBe("__none__");
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [
        epic({
          id: "e1",
          valueStreamId: null,
          valueStream: null,
          allocations: { "2026-H1": 10_000 },
        }),
      ],
    });
    const unassigned = s.valueStreams.find((v) => v.valueStreamId === "__none__");
    expect(unassigned).toBeDefined();
    expect(unassigned!.name).toBe("Ohne Wertstrom");
    expect(unassigned!.total).toBe(10_000);
  });

  it("reuses aggregateArtFeatureLoad and emits a (zeroed) Backlog bucket per ART", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [epic({ id: "e1", allocations: { "2026-H1": 100_000 } })],
      artRows: [{ artId: "a1", name: "ART 1", budgetByPeriod: {} }],
      features: [
        feature({ featureId: "f1", artId: "a1", piStartDate: utc("2026-02-01"), wsjfJobSize: 8 }),
      ],
    });
    const art = s.arts.find((a) => a.artId === "a1")!;
    // Snapshot Features always carry a PI, so the Backlog bucket is present-but-zero.
    expect(art.loadBacklog).toEqual({ featureCount: 0, jobSizeSum: 0 });
    expect(art.loadByPeriod["2026-H1"]).toEqual({ featureCount: 1, jobSizeSum: 8 });
  });

  it("emits cycleBudgetSum + followBudgetSum; summarizeSnapshot reads the frozen values", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [
        epic({ id: "e1", allocations: { "2026-H1": 120_000, "2026-H2": 150_000 } }),
        epic({ id: "e2", allocations: { "2026-H1": 30_000, "2027-H1": 80_000 } }),
      ],
    });
    expect(s.cycleBudgetSum).toBe(150_000); // 120k + 30k in the 2026-H1 cycle
    expect(s.followBudgetSum).toBe(230_000); // 150k + 80k in later half-years
    expect(summarizeSnapshot(s)).toEqual({ cycleBudgetSum: 150_000, followBudgetSum: 230_000 });
  });

  it("summarizeSnapshot falls back to reducing Epics for pre-totals (legacy) snapshots", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      epics: [epic({ id: "e1", allocations: { "2026-H1": 100_000, "2026-H2": 40_000 } })],
    });
    const legacy = { ...s } as Record<string, unknown>;
    delete legacy.cycleBudgetSum;
    delete legacy.followBudgetSum;
    expect(summarizeSnapshot(legacy as unknown as BudgetPlanSnapshot)).toEqual({
      cycleBudgetSum: 100_000,
      followBudgetSum: 40_000,
    });
  });

  it("computeDisplayPeriods anchors on the half-year before the cycle and hides earlier history", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      cycleKey: "2026-H2",
      capturedAt: utc("2026-07-01"),
      pool: {},
      epics: [
        epic({ id: "old", allocations: { "2025-H1": 10_000 } }), // earlier — hidden
        epic({ id: "cur", allocations: { "2026-H2": 50_000 } }),
        epic({ id: "later", allocations: { "2027-H1": 20_000 } }),
      ],
    });
    const dp = computeDisplayPeriods(s);
    expect(dp.map((p) => p.key)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
    expect(dp.find((p) => p.key === "2026-H2")!.isCurrent).toBe(true);
    expect(dp.find((p) => p.key === "2026-H1")!.isCurrent).toBe(false);
  });

  it("stamps the cycle label via halfYearLabel and serialises capturedAt to ISO", () => {
    const s = buildBudgetPlanSnapshot({
      ...baseInputs,
      cycleKey: "2026-H2",
      capturedAt: utc("2026-07-01"),
      epics: [],
    });
    expect(s.cycleKey).toBe("2026-H2");
    expect(s.cycleLabel).toBe("H2 2026");
    expect(s.capturedAt).toBe("2026-07-01T00:00:00.000Z");
  });
});
