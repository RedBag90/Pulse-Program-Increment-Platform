import { describe, it, expect } from "vitest";
import {
  buildPortfolioOverviewModel,
  type PortfolioOverviewInputs,
} from "@/modules/work/server/views/portfolio-overview";

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
  ownerId?: string | null;
  businessCaseApprovedAt?: Date | null;
  updatedAt?: Date;
  vsName?: string | null;
  steering?: boolean;
}) {
  return {
    id: p.id,
    title: p.title,
    status: p.status ?? "approved",
    stageGate: p.stageGate ?? "L2",
    ownerId: p.ownerId ?? null,
    businessCaseApprovedAt: p.businessCaseApprovedAt ?? null,
    valueStream: p.vsName ? { id: `vs-${p.id}`, name: p.vsName } : null,
    updatedAt: p.updatedAt ?? daysAgo(1),
    needsSteeringAttention: p.steering ?? false,
    // Extra Prisma fields the builder ignores — kept as `unknown` cast.
  } as unknown as PortfolioOverviewInputs["epics"][number];
}

function baseInputs(): PortfolioOverviewInputs {
  return {
    epics: [],
    themes: [],
    board: { periods: [], pool: {} },
    vsBudgets: { valueStreams: [] },
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

  it("L2 + BC-approved faellt in die L3-Bucket (Kanban 'Portfolio Backlog')", () => {
    const inputs = baseInputs();
    inputs.epics = [
      // L2 ohne BC-Approval → Analyzing
      epic({
        id: "drafting-bc",
        title: "Drafting BC",
        stageGate: "L2",
        businessCaseApprovedAt: null,
      }),
      // L2 + BC-approved → visuell L3
      epic({
        id: "ready-for-budget",
        title: "Ready",
        stageGate: "L2",
        businessCaseApprovedAt: daysAgo(2),
      }),
      // echtes L3 → L3
      epic({ id: "funded", title: "Funded", stageGate: "L3" }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.epicsByGate.L2.map((c) => c.id)).toEqual(["drafting-bc"]);
    expect(m.epicsByGate.L3.map((c) => c.id).sort()).toEqual(["funded", "ready-for-budget"]);
    // Daten-Modell-stageGate bleibt L2 fuer das L2+BC-approved-Epic.
    const promoted = m.epicsByGate.L3.find((c) => c.id === "ready-for-budget");
    expect(promoted?.stageGate).toBe("L2");
  });

  it("L0 + owner faellt in die L1-Bucket (Kanban 'Hypothese erstellen')", () => {
    const inputs = baseInputs();
    inputs.epics = [
      // L0 ohne Owner → Funnel
      epic({ id: "idea", title: "Idea", stageGate: "L0", ownerId: null }),
      // L0 mit Owner → visuell L1
      epic({ id: "drafting", title: "Drafting", stageGate: "L0", ownerId: "user-1" }),
      // echtes L1 → L1
      epic({ id: "approved", title: "Approved", stageGate: "L1", ownerId: "user-2" }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.epicsByGate.L0.map((c) => c.id)).toEqual(["idea"]);
    expect(m.epicsByGate.L1.map((c) => c.id).sort()).toEqual(["approved", "drafting"]);
    // Daten-Modell-stageGate bleibt L0 fuer den drafting-Epic, nur der Bucket
    // ist L1. Konsumenten der Karte sehen den echten Stage-Gate-Wert.
    const drafting = m.epicsByGate.L1.find((c) => c.id === "drafting");
    expect(drafting?.stageGate).toBe("L0");
  });

  it("sorts steering-flagged epics to the top of each gate, oldest-first within each group", () => {
    const inputs = baseInputs();
    inputs.epics = [
      // unmarkiert, älteste → unter den markierten, aber an Spitze der unmarkierten
      epic({ id: "a", title: "A", stageGate: "L2", updatedAt: daysAgo(20) }),
      // unmarkiert, jünger
      epic({ id: "b", title: "B", stageGate: "L2", updatedAt: daysAgo(2) }),
      // markiert + jung → trotzdem ganz oben
      epic({
        id: "flag-young",
        title: "Flag (jung)",
        stageGate: "L2",
        updatedAt: daysAgo(1),
        steering: true,
      }),
      // markiert + älter → vor dem jungen markierten
      epic({
        id: "flag-old",
        title: "Flag (alt)",
        stageGate: "L2",
        updatedAt: daysAgo(15),
        steering: true,
      }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.epicsByGate.L2.map((c) => c.id)).toEqual(["flag-old", "flag-young", "a", "b"]);
    // oldestPerGate ist von der Display-Sortierung entkoppelt — das wirklich
    // älteste Epic (`a` mit 20 Tagen) bleibt der „slowest mover".
    expect(m.oldestPerGate.L2?.id).toBe("a");
  });

  it("counts goalsOnTrack only among active themes with run-rate >= 70% of planned", () => {
    const inputs = baseInputs();
    inputs.themes = [
      {
        id: "t1",
        title: "ontrack",
        status: "active",
        // completion 0.8 (KR-Ø); runRate 80/100 → !isAtRisk
        progress: 0.8,
        trio: { planned: 100, realized: 80, runRate: 80 },
        epicLinkCount: 0,
      },
      {
        id: "t2",
        title: "behind",
        status: "active",
        // completion 0.2; runRate 20/100 → isAtRisk
        progress: 0.2,
        trio: { planned: 100, realized: 20, runRate: 20 },
        epicLinkCount: 0,
      },
      {
        id: "t3",
        title: "closed",
        // Closed goal-status (achieved) → nicht in-flight, zählt nicht mit.
        status: "achieved",
        progress: 1,
        trio: { planned: 100, realized: 100, runRate: 100 },
        epicLinkCount: 0,
      },
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.goalsOnTrack).toBe(1);
    expect(m.topGoal?.id).toBe("t1");
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
      periods: [
        { key: "2026-H1", label: "H1 2026" },
        { key: "2026-H2", label: "H2 2026" },
        { key: "2027-H1", label: "H1 2027" },
        { key: "2027-H2", label: "H2 2027" },
      ],
      pool: { "2026-H1": 100, "2026-H2": 80 },
    };
    inputs.vsBudgets = {
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
