import { describe, it, expect } from "vitest";
import {
  composeRtePortfolioRow,
  pickRecentPiPredictability,
  rollUpEpics,
  type RtePortfolioInputs,
  type RecentFeatureRow,
  type ActiveFeatureRow,
  type EpicRow,
} from "@/server/views/rte-cockpit";

describe("pickRecentPiPredictability", () => {
  it("returns null when there is no closed-PI history", () => {
    expect(pickRecentPiPredictability([], [])).toBeNull();
  });

  it("averages delivered/committed across the last ≤3 closed PIs", () => {
    const pis = [
      { id: "pi-3", name: "2026-Q1" },
      { id: "pi-2", name: "2025-Q4" },
      { id: "pi-1", name: "2025-Q3" },
    ];
    const features: RecentFeatureRow[] = [
      { piId: "pi-3", status: "completed" },
      { piId: "pi-3", status: "completed" },
      { piId: "pi-3", status: "in_progress" }, // pi-3: 2/3
      { piId: "pi-2", status: "completed" }, // pi-2: 1/1
      { piId: "pi-1", status: "draft" }, // pi-1: 0/1
    ];
    const res = pickRecentPiPredictability(pis, features);
    expect(res).not.toBeNull();
    expect(res!.piNames).toEqual(["2026-Q1", "2025-Q4", "2025-Q3"]);
    // (2/3 + 1 + 0) / 3 ≈ 0.5556
    expect(res!.value).toBeCloseTo(0.5556, 3);
  });

  it("skips PIs with no features when averaging", () => {
    const pis = [
      { id: "pi-a", name: "A" },
      { id: "pi-b", name: "B" },
    ];
    const features: RecentFeatureRow[] = [{ piId: "pi-a", status: "completed" }];
    const res = pickRecentPiPredictability(pis, features);
    expect(res!.value).toBe(1);
  });
});

describe("rollUpEpics", () => {
  const epic = (over: Partial<EpicRow> = {}): EpicRow => ({
    id: "e1",
    title: "Open Banking",
    status: "approved",
    ...over,
  });
  const feature = (over: Partial<ActiveFeatureRow>): ActiveFeatureRow => ({
    id: "f1",
    parentId: "e1",
    title: "f",
    status: "in_progress",
    ...over,
  });

  it("groups features under their parent Epic", () => {
    const rows = rollUpEpics(
      [epic({ id: "e1" }), epic({ id: "e2", title: "Risk" })],
      [
        feature({ id: "f1", parentId: "e1" }),
        feature({ id: "f2", parentId: "e1" }),
        feature({ id: "f3", parentId: "e2" }),
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.epicId).toBe("e1");
    expect(rows[0]!.features).toHaveLength(2);
    expect(rows[1]!.features).toHaveLength(1);
  });

  it("sets hypothesisSignal=red for blocked/cancelled epics", () => {
    const rows = rollUpEpics(
      [epic({ id: "e1", status: "blocked" })],
      [feature({ id: "f1", parentId: "e1" })],
    );
    expect(rows[0]!.hypothesisSignal).toBe("red");
  });

  it("sets hypothesisSignal=muted when an epic has zero features in the PI", () => {
    const rows = rollUpEpics([epic({ id: "e1" })], []);
    expect(rows[0]!.hypothesisSignal).toBe("muted");
  });

  it("orders epics by feature count descending", () => {
    const rows = rollUpEpics(
      [epic({ id: "e1" }), epic({ id: "e2" })],
      [
        feature({ id: "f1", parentId: "e2" }),
        feature({ id: "f2", parentId: "e2" }),
        feature({ id: "f3", parentId: "e1" }),
      ],
    );
    expect(rows[0]!.epicId).toBe("e2");
  });
});

describe("composeRtePortfolioRow", () => {
  const baseInputs = (over: Partial<RtePortfolioInputs>): RtePortfolioInputs => ({
    artId: "art-1",
    artName: "Banking Core",
    activePiName: "2026-Q2",
    teamCount: 5,
    escalatedImpediments: 0,
    openApprovals: 0,
    confidences: [],
    ...over,
  });

  it("green when confidence ≥ 4 and no escalations", () => {
    const row = composeRtePortfolioRow(baseInputs({ confidences: [4, 5, 4] }));
    expect(row.rag).toBe("green");
    expect(row.confidenceAvg).toBeCloseTo(4.333, 2);
  });

  it("amber when there is at least one escalation, regardless of confidence", () => {
    const row = composeRtePortfolioRow(
      baseInputs({ confidences: [5, 5, 5], escalatedImpediments: 1 }),
    );
    expect(row.rag).toBe("amber");
  });

  it("red when avg confidence < 3", () => {
    const row = composeRtePortfolioRow(baseInputs({ confidences: [1, 2, 2] }));
    expect(row.rag).toBe("red");
  });

  it("muted when there are no confidence votes and no escalations", () => {
    const row = composeRtePortfolioRow(baseInputs({}));
    expect(row.rag).toBe("muted");
    expect(row.confidenceAvg).toBeNull();
  });
});
