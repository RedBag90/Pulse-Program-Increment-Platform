import { describe, it, expect } from "vitest";
import {
  computePortfolioGuardrails,
  type GuardrailsEpicInput,
} from "@/server/views/portfolio-guardrails-view";
import { DEFAULT_GUARDRAIL_TARGETS } from "@/domain/portfolio-guardrails";

const epic = (over: Partial<GuardrailsEpicInput> = {}): GuardrailsEpicInput => ({
  id: "e1",
  title: "Epic",
  epicType: null,
  investmentHorizon: null,
  amount: null,
  stageGate: "L0",
  needsSteeringAttention: false,
  ...over,
});

describe("computePortfolioGuardrails", () => {
  it("ist leer wenn keine Epics existieren", () => {
    const m = computePortfolioGuardrails({ epics: [], targets: DEFAULT_GUARDRAIL_TARGETS });
    expect(m.horizon.totalCount).toBe(0);
    expect(m.horizon.status).toBe("unknown");
    expect(m.capacity.status).toBe("unknown");
    expect(m.horizonCoverageThin).toBe(false);
    expect(m.capacityCoverageThin).toBe(false);
    expect(m.horizon.epicsByStage.L0).toEqual([]);
    expect(m.horizon.epicsByStage.L5).toEqual([]);
  });

  it("verteilt epics auf die richtige Stage und reicht Horizon + Steering durch", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", investmentHorizon: "h1", stageGate: "L2" }),
        epic({
          id: "b",
          investmentHorizon: "h3",
          stageGate: "L2",
          needsSteeringAttention: true,
        }),
        epic({ id: "c", investmentHorizon: null, stageGate: "L4" }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.epicsByStage.L2).toHaveLength(2);
    expect(m.horizon.epicsByStage.L2[0]?.horizon).toBe("h1");
    expect(m.horizon.epicsByStage.L2[1]?.horizon).toBe("h3");
    expect(m.horizon.epicsByStage.L2[1]?.needsSteeringAttention).toBe(true);
    expect(m.horizon.epicsByStage.L4).toHaveLength(1);
    expect(m.horizon.epicsByStage.L4[0]?.horizon).toBeNull();
    expect(m.horizon.epicsByStage.L0).toEqual([]);
  });

  it("sortiert epics pro stage nach horizon (H1 -> H2 -> H3 -> null), stabil", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "p", investmentHorizon: "h3", stageGate: "L3" }),
        epic({ id: "q", investmentHorizon: null, stageGate: "L3" }),
        epic({ id: "r", investmentHorizon: "h1", stageGate: "L3" }),
        epic({ id: "s", investmentHorizon: "h2", stageGate: "L3" }),
        epic({ id: "t", investmentHorizon: "h1", stageGate: "L3" }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.epicsByStage.L3.map((e) => e.id)).toEqual(["r", "t", "s", "p", "q"]);
  });

  it("ignoriert unbekannte stageGate-Werte (kein Crash)", () => {
    const m = computePortfolioGuardrails({
      epics: [epic({ id: "x", stageGate: "L99" as unknown as string })],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    for (const g of Object.values(m.horizon.epicsByStage)) {
      expect(g).toEqual([]);
    }
  });

  it("teilt klassifizierte Epics nach Horizon auf und ignoriert die unklassifizierten im Mix", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", investmentHorizon: "h1", amount: 100 }),
        epic({ id: "b", investmentHorizon: "h1", amount: 100 }),
        epic({ id: "c", investmentHorizon: "h2", amount: 50 }),
        epic({ id: "d", investmentHorizon: null, amount: 999 }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.rows.h1.count).toBe(2);
    expect(m.horizon.rows.h2.count).toBe(1);
    expect(m.horizon.rows.h3.count).toBe(0);
    expect(m.horizon.unclassifiedCount).toBe(1);
    expect(m.horizon.rows.h1.countShare).toBeCloseTo(2 / 3);
    expect(m.horizon.rows.h1.amountShare).toBeCloseTo(200 / 250);
    expect(m.horizon.totalCount).toBe(4);
  });

  it("epicCapacityBucket: solution+epic = business, enabler = enabler", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", epicType: "solution", amount: 10 }),
        epic({ id: "b", epicType: "epic", amount: 10 }),
        epic({ id: "c", epicType: "enabler", amount: 5 }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.capacity.rows.business.count).toBe(2);
    expect(m.capacity.rows.enabler.count).toBe(1);
    expect(m.capacity.rows.business.amountShare).toBeCloseTo(20 / 25);
  });

  it("ampel: gruen wenn alle deltas <=5pp", () => {
    const m = computePortfolioGuardrails({
      epics: [
        // Target 70/20/10. Mix mit 7/2/1 = exakt 70/20/10.
        ...new Array(7).fill(0).map((_, i) => epic({ id: `h1-${i}`, investmentHorizon: "h1" })),
        ...new Array(2).fill(0).map((_, i) => epic({ id: `h2-${i}`, investmentHorizon: "h2" })),
        epic({ id: "h3-0", investmentHorizon: "h3" }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.status).toBe("green");
  });

  it("ampel: rot wenn max delta >15pp", () => {
    const m = computePortfolioGuardrails({
      epics: [
        // 100 % H3 vs Target 10 % H3 — Δ = 90pp.
        epic({ id: "x", investmentHorizon: "h3" }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.status).toBe("red");
  });

  it("coverageThin: >20% unklassifiziert → Hinweis", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", investmentHorizon: "h1", epicType: "epic" }),
        epic({ id: "b", investmentHorizon: "h1", epicType: "epic" }),
        epic({ id: "c", investmentHorizon: null, epicType: null }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizonCoverageThin).toBe(true);
    expect(m.capacityCoverageThin).toBe(true);
  });

  it("targets reagieren auf custom-Werte", () => {
    const m = computePortfolioGuardrails({
      epics: [epic({ id: "a", investmentHorizon: "h1" })],
      targets: { horizon: { h1: 100, h2: 0, h3: 0 }, capacity: { business: 100, enabler: 0 } },
    });
    expect(m.horizon.rows.h1.deltaCount).toBeCloseTo(0);
    expect(m.horizon.status).toBe("green");
  });

  it("amount = null zaehlt nur in Count-Mix", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", investmentHorizon: "h1", amount: null }),
        epic({ id: "b", investmentHorizon: "h2", amount: 0 }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.rows.h1.count).toBe(1);
    expect(m.horizon.rows.h2.count).toBe(1);
    expect(m.horizon.rows.h1.amount).toBe(0);
    expect(m.horizon.rows.h2.amount).toBe(0);
  });
});
