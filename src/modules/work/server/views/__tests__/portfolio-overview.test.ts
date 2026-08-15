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
  /** Sets timeline.estimates.implementation (L4-Abschluss estimate), ISO yyyy-mm-dd. */
  implEstimate?: string;
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
    timeline: p.implEstimate
      ? { estimates: { implementation: p.implEstimate }, actuals: {} }
      : null,
    // Extra Prisma fields the builder ignores — kept as `unknown` cast.
  } as unknown as PortfolioOverviewInputs["epics"][number];
}

/** A tenant-wide Feature row (as `listOverviewFeatures` returns it). */
function feature(p: {
  id: string;
  title: string;
  piEndDate: Date | null;
  epic?: { id: string; title: string; vsName?: string | null } | null;
}) {
  return {
    id: p.id,
    title: p.title,
    pi: p.piEndDate ? { endDate: p.piEndDate } : null,
    parent: p.epic
      ? {
          id: p.epic.id,
          title: p.epic.title,
          valueStream: p.epic.vsName ? { name: p.epic.vsName } : null,
        }
      : null,
  } as unknown as PortfolioOverviewInputs["features"][number];
}

function baseInputs(): PortfolioOverviewInputs {
  return {
    epics: [],
    features: [],
    risks: [],
    goalContributions: [],
    ownerLabels: {},
    themes: [],
    board: { periods: [], pool: {} },
    vsBudgets: { valueStreams: [] },
    activePis: [],
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

  // NOW = 2026-06-15.
  it("l4DueSoon: only L4 epics with an implementation estimate ≤ 4 weeks (overdue first)", () => {
    const inputs = baseInputs();
    inputs.epics = [
      epic({ id: "soon", title: "Soon", stageGate: "L4", implEstimate: "2026-06-25" }), // +10d
      epic({ id: "over", title: "Over", stageGate: "L4", implEstimate: "2026-06-10" }), // -5d overdue
      epic({ id: "far", title: "Far", stageGate: "L4", implEstimate: "2026-07-25" }), // +40d out
      epic({ id: "notL4", title: "NotL4", stageGate: "L2", implEstimate: "2026-06-20" }), // wrong gate
      epic({ id: "noEst", title: "NoEst", stageGate: "L4" }), // no estimate
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.l4DueSoon.map((x) => x.id)).toEqual(["over", "soon"]); // overdue (earlier date) first
    const over = m.l4DueSoon[0]!;
    expect(over.overdue).toBe(true);
    expect(over.daysUntil).toBe(-5);
    expect(m.l4DueSoon[1]!.overdue).toBe(false);
    expect(m.l4DueSoon[1]!.daysUntil).toBe(10);
  });

  it("featuresDueSoon: PI-end ≤ 2 weeks, overdue first, parent Epic carried; null PI ignored", () => {
    const inputs = baseInputs();
    inputs.features = [
      feature({
        id: "f-soon",
        title: "Soon",
        piEndDate: new Date("2026-06-18T00:00:00.000Z"), // +3d
        epic: { id: "e1", title: "Epic One", vsName: "Payments" },
      }),
      feature({
        id: "f-over",
        title: "Over",
        piEndDate: new Date("2026-06-13T00:00:00.000Z"), // -2d overdue
        epic: { id: "e2", title: "Epic Two", vsName: "CX" },
      }),
      feature({ id: "f-far", title: "Far", piEndDate: new Date("2026-07-05T00:00:00.000Z") }), // +20d out
      feature({ id: "f-noPi", title: "NoPi", piEndDate: null }), // backlog → ignored
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.featuresDueSoon.map((x) => x.id)).toEqual(["f-over", "f-soon"]);
    expect(m.featuresDueSoon[0]!.overdue).toBe(true);
    expect(m.featuresDueSoon[0]!.daysUntil).toBe(-2);
    // parent Epic + value stream carried through
    expect(m.featuresDueSoon[1]!.epic).toEqual({ id: "e1", title: "Epic One" });
    expect(m.featuresDueSoon[1]!.subtitle).toBe("Payments");
  });

  it("risks: sorted by score desc, unscored (null) last, riskNumber tie-break", () => {
    const inputs = baseInputs();
    inputs.risks = [
      { id: "r1", riskNumber: 1, title: "Low", band: "low", score: 4, roamStatus: "open", epic: null },
      {
        id: "r2",
        riskNumber: 2,
        title: "Crit",
        band: "critical",
        score: 20,
        roamStatus: "owned",
        epic: { id: "e1", title: "Epic One" },
      },
      { id: "r3", riskNumber: 3, title: "Unscored", band: null, score: null, roamStatus: "open", epic: null },
      { id: "r4", riskNumber: 4, title: "High", band: "high", score: 12, roamStatus: "mitigated", epic: null },
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.risks.map((x) => x.id)).toEqual(["r2", "r4", "r1", "r3"]);
  });

  it("goalContributions: sorted by total planned (Σ over units, recurring + one-time) desc", () => {
    const inputs = baseInputs();
    inputs.goalContributions = [
      // total planned 150 (100 € recurring + 50 € one-time)
      {
        epicId: "a",
        title: "A",
        valueStreamName: "VS",
        recurring: [{ unit: "€", planned: 100, realized: 0 }],
        oneTime: [{ unit: "€", planned: 50, realized: 0 }],
      },
      // total planned 400 (300 € + 100 „%" — Ranking summiert Einheiten heuristisch)
      {
        epicId: "b",
        title: "B",
        valueStreamName: null,
        recurring: [
          { unit: "€", planned: 300, realized: 0 },
          { unit: "%", planned: 100, realized: 0 },
        ],
        oneTime: [],
      },
      // total planned 220
      {
        epicId: "c",
        title: "C",
        valueStreamName: null,
        recurring: [],
        oneTime: [{ unit: "Stück", planned: 220, realized: 0 }],
      },
    ];
    const m = buildPortfolioOverviewModel(inputs);
    expect(m.goalContributions.map((x) => x.epicId)).toEqual(["b", "c", "a"]);
  });

  it("steeringEpics: only flagged epics, owner resolved from labels, sorted by daysSinceUpdate desc", () => {
    const inputs = baseInputs();
    inputs.ownerLabels = { "u-1": "alice@example.com" };
    inputs.epics = [
      epic({
        id: "s-old",
        title: "Old flagged",
        steering: true,
        ownerId: "u-1",
        updatedAt: daysAgo(40),
        vsName: "Payments",
      }),
      epic({ id: "s-new", title: "New flagged", steering: true, ownerId: "u-x", updatedAt: daysAgo(5) }),
      epic({ id: "not", title: "Unflagged", steering: false, updatedAt: daysAgo(60) }),
    ];
    const m = buildPortfolioOverviewModel(inputs);
    // only flagged, longest-without-update first
    expect(m.steeringEpics.map((x) => x.id)).toEqual(["s-old", "s-new"]);
    expect(m.steeringEpics[0]!.ownerName).toBe("alice@example.com");
    expect(m.steeringEpics[0]!.valueStreamName).toBe("Payments");
    // owner id without a label → null
    expect(m.steeringEpics[1]!.ownerName).toBeNull();
  });
});
