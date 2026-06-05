import { describe, it, expect } from "vitest";
import {
  buildPortfolioOverviewModel,
  type PortfolioOverviewInputs,
} from "@/server/views/portfolio-overview";

/**
 * Builder tests at the page-model seam. Fixtures are in-memory; `now` is
 * pinned so the "current cycle" + "stale window" are deterministic.
 */

const NOW = new Date("2026-06-15T00:00:00.000Z"); // 2026-H1
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

function epic(p: {
  id: string;
  title: string;
  status?: string;
  stageGate?: string;
  updatedAt?: Date;
  vsName?: string | null;
  steering?: boolean;
}) {
  return {
    id: p.id,
    title: p.title,
    status: p.status ?? "approved",
    stageGate: p.stageGate ?? "L2",
    valueStream: p.vsName ? { id: `vs-${p.id}`, name: p.vsName } : null,
    updatedAt: p.updatedAt ?? daysAgo(1),
    needsSteeringAttention: p.steering ?? false,
    // Extra Prisma fields the builder ignores — kept as `unknown` cast.
  } as unknown as PortfolioOverviewInputs["epics"][number];
}

function baseInputs(): PortfolioOverviewInputs {
  return {
    epics: [],
    goals: [],
    board: { epics: [], periods: [], pool: {} },
    vsBudgets: { periods: [], valueStreams: [] },
    activePis: [],
    impedimentsOpen: 0,
    structureGap: { hasTarget: false, targetDate: null, dimensions: [], overallProgress: 0 },
    practiceAdoption: { hasTarget: false, signals: [] },
    now: NOW,
  };
}

describe("buildPortfolioOverviewModel", () => {
  it("groups epics by stage gate and sorts each group by daysSinceUpdate desc", () => {
    const inputs = baseInputs();
    inputs.epics = [
      epic({ id: "a", title: "A", stageGate: "L2", updatedAt: daysAgo(2) }),
      epic({ id: "b", title: "B", stageGate: "L2", updatedAt: daysAgo(10) }),
      epic({ id: "c", title: "C", stageGate: "L0", updatedAt: daysAgo(5) }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.epicsByGate.L2.map((c) => c.id)).toEqual(["b", "a"]);
    expect(m.epicsByGate.L0.map((c) => c.id)).toEqual(["c"]);
    expect(m.oldestPerGate.L2?.id).toBe("b");
    expect(m.oldestPerGate.L0?.id).toBe("c");
    expect(m.oldestPerGate.L4).toBeNull();
  });

  it("counts goalsOnTrack only among active goals with progress >= 0.5", () => {
    const inputs = baseInputs();
    inputs.goals = [
      {
        id: "g1",
        title: "ontrack",
        status: "active",
        kpis: [{ baseline: 0, target: 10, current: 8 }],
        epicLinks: [],
      },
      {
        id: "g2",
        title: "behind",
        status: "active",
        kpis: [{ baseline: 0, target: 10, current: 2 }],
        epicLinks: [],
      },
      {
        id: "g3",
        title: "achieved-archived",
        status: "archived",
        kpis: [{ baseline: 0, target: 10, current: 10 }],
        epicLinks: [],
      },
    ] as unknown as PortfolioOverviewInputs["goals"];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.goalsOnTrack).toBe(1);
    expect(m.topGoal?.id).toBe("g1");
    expect(m.goalAverageProgress).toBeCloseTo(0.5);
  });

  it("returns topGoal=null and 0% average when there are no active goals", () => {
    const m = buildPortfolioOverviewModel(baseInputs());
    expect(m.topGoal).toBeNull();
    expect(m.goalAverageProgress).toBe(0);
    expect(m.goalsOnTrack).toBe(0);
  });

  it("funnelConversion = done90 / (done90 + funnel); degrades to 0 when both empty", () => {
    const inputs = baseInputs();
    inputs.epics = [
      epic({ id: "d1", stageGate: "L5", updatedAt: daysAgo(30), title: "d1" }),
      epic({ id: "d2", stageGate: "L5", updatedAt: daysAgo(30), title: "d2" }),
      epic({ id: "f1", stageGate: "L0", updatedAt: daysAgo(1), title: "f1" }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.doneInLast90Days).toBe(2);
    expect(m.funnelConversion).toBeCloseTo(2 / 3);

    const empty = buildPortfolioOverviewModel(baseInputs());
    expect(empty.funnelConversion).toBe(0);
  });

  it("marks the current cycle and trims upcomingPeriods to 2", () => {
    const inputs = baseInputs();
    inputs.board = {
      epics: [],
      periods: [
        { key: "2026-H1", label: "H1 2026" },
        { key: "2026-H2", label: "H2 2026" },
        { key: "2027-H1", label: "H1 2027" },
        { key: "2027-H2", label: "H2 2027" },
      ],
      pool: { "2026-H1": 100, "2026-H2": 80 },
    };
    inputs.vsBudgets = {
      periods: inputs.board.periods,
      valueStreams: [{ valueStreamId: "vs1", name: "VS1", byPeriod: { "2026-H1": 40 }, total: 40 }],
    };
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.funding.currentPeriodKey).toBe("2026-H1");
    expect(m.funding.currentPeriod?.allocated).toBe(40);
    expect(m.funding.currentPeriod?.remaining).toBe(60);
    expect(m.funding.upcomingPeriods.map((p) => p.key)).toEqual(["2026-H2", "2027-H1"]);
    expect(m.poolTotal).toBe(180);
    expect(m.poolAllocated).toBe(40);
    expect(m.poolFree).toBe(140);
  });

  it("recentActivity holds the 5 most recently touched epics, newest first", () => {
    const inputs = baseInputs();
    inputs.epics = [
      epic({ id: "1", title: "1", updatedAt: daysAgo(10) }),
      epic({ id: "2", title: "2", updatedAt: daysAgo(1) }),
      epic({ id: "3", title: "3", updatedAt: daysAgo(5) }),
      epic({ id: "4", title: "4", updatedAt: daysAgo(2) }),
      epic({ id: "5", title: "5", updatedAt: daysAgo(3) }),
      epic({ id: "6", title: "6", updatedAt: daysAgo(20) }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.recentActivity.map((e) => e.id)).toEqual(["2", "4", "5", "3", "1"]);
  });

  it("flags stale and blocked epics by their explicit rules", () => {
    const inputs = baseInputs();
    inputs.epics = [
      epic({ id: "stale", title: "stale", updatedAt: daysAgo(45) }),
      epic({ id: "fresh", title: "fresh", updatedAt: daysAgo(2) }),
      epic({ id: "stale-done", title: "stale-done", status: "completed", updatedAt: daysAgo(60) }),
      epic({ id: "blocked", title: "blocked", status: "blocked", updatedAt: daysAgo(1) }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.staleEpics.map((c) => c.id)).toEqual(["stale"]);
    expect(m.blockedEpics.map((c) => c.id)).toEqual(["blocked"]);
  });
});
