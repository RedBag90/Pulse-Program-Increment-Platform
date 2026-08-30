import { describe, it, expect } from "vitest";
import {
  computePortfolioGuardrails,
  computeBusinessOwnerEngagement,
  type BoApprovalInput,
  type BoEngagementEpicInput,
  type GuardrailsEpicInput,
} from "@/modules/work/server/views/portfolio-guardrails-view";
import { DEFAULT_GUARDRAIL_TARGETS } from "@/modules/work/domain/portfolio-guardrails";

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
    // Sortierung h3 → h1 (Anzeige-Reihenfolge R&D oben).
    expect(m.horizon.epicsByStage.L2[0]?.horizon).toBe("h3");
    expect(m.horizon.epicsByStage.L2[0]?.needsSteeringAttention).toBe(true);
    expect(m.horizon.epicsByStage.L2[1]?.horizon).toBe("h1");
    expect(m.horizon.epicsByStage.L4).toHaveLength(1);
    expect(m.horizon.epicsByStage.L4[0]?.horizon).toBeNull();
    expect(m.horizon.epicsByStage.L0).toEqual([]);
  });

  it("sortiert epics pro stage nach horizon (H3 -> H2 -> H1 -> H0 -> null), stabil", () => {
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
    expect(m.horizon.epicsByStage.L3.map((e) => e.id)).toEqual(["p", "s", "r", "t", "q"]);
  });

  it("baut epicsByHorizon (H1/H2/H3/none) und sortiert pro Spalte nach Stage-Index", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", investmentHorizon: "h1", stageGate: "L4" }),
        epic({ id: "b", investmentHorizon: "h1", stageGate: "L0" }),
        epic({ id: "c", investmentHorizon: "h2", stageGate: "L3" }),
        epic({ id: "d", investmentHorizon: "h3", stageGate: "L1" }),
        epic({ id: "e", investmentHorizon: null, stageGate: "L2" }),
        epic({ id: "f", investmentHorizon: null, stageGate: "L5" }),
      ],
      targets: DEFAULT_GUARDRAIL_TARGETS,
    });
    expect(m.horizon.epicsByHorizon.h1.map((e) => e.id)).toEqual(["b", "a"]);
    expect(m.horizon.epicsByHorizon.h2.map((e) => e.id)).toEqual(["c"]);
    expect(m.horizon.epicsByHorizon.h3.map((e) => e.id)).toEqual(["d"]);
    expect(m.horizon.epicsByHorizon.none.map((e) => e.id)).toEqual(["e", "f"]);
    expect(m.horizon.epicsByHorizon.h1[0]?.stageGate).toBe("L0");
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

  it("epicCapacityBucket: epic = business, enabler = enabler", () => {
    const m = computePortfolioGuardrails({
      epics: [
        epic({ id: "a", epicType: "epic", amount: 10 }),
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
        // Target h3/h2/h1/h0 = 10/20/60/10. Mix mit 1/2/6/1 = exakt 10/20/60/10.
        ...new Array(6).fill(0).map((_, i) => epic({ id: `h1-${i}`, investmentHorizon: "h1" })),
        ...new Array(2).fill(0).map((_, i) => epic({ id: `h2-${i}`, investmentHorizon: "h2" })),
        epic({ id: "h3-0", investmentHorizon: "h3" }),
        epic({ id: "h0-0", investmentHorizon: "h0" }),
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
      targets: {
        ...DEFAULT_GUARDRAIL_TARGETS,
        horizon: { h0: 0, h1: 100, h2: 0, h3: 0 },
        capacity: { business: 100, enabler: 0 },
      },
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

// ── Guardrail 4 — Business-Owner-Engagement ─────────────────────────────────

const NOW = new Date("2026-08-30T12:00:00Z");
const ENGAGEMENT_TARGETS = { coverage: 90, responseDays: 10 };

/** Tage vor NOW als Datum. */
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const approval = (over: Partial<BoApprovalInput> = {}): BoApprovalInput => ({
  revision: 1,
  approverUserId: "u1",
  approverLabel: "bo@pulse.dev",
  status: "pending",
  requestedAt: daysAgo(1),
  decidedAt: null,
  ...over,
});

const boEpic = (over: Partial<BoEngagementEpicInput> = {}): BoEngagementEpicInput => ({
  epicId: "e1",
  title: "Epic",
  approvalRevision: 1,
  approvals: [approval()],
  ...over,
});

const engagement = (epics: BoEngagementEpicInput[]) =>
  computeBusinessOwnerEngagement({ epics, targets: ENGAGEMENT_TARGETS, now: NOW });

describe("computeBusinessOwnerEngagement", () => {
  it("meldet unknown statt 0 %, wenn kein Epic im Freigabelauf ist", () => {
    const m = engagement([]);
    expect(m.scopeCount).toBe(0);
    expect(m.coverageRatio).toBeNull();
    expect(m.responseRatio).toBeNull();
    expect(m.status).toBe("unknown");
    expect(m.overdue).toEqual([]);
  });

  it("senkt die Abdeckung, wenn eine Zeile niemandem zugewiesen ist", () => {
    const m = engagement([
      boEpic({ epicId: "a" }),
      boEpic({
        epicId: "b",
        approvals: [approval({ approverUserId: null, approverLabel: null })],
      }),
    ]);
    expect(m.coveredCount).toBe(1);
    expect(m.coverageRatio).toBeCloseTo(0.5);
  });

  it("zaehlt ein Epic ganz ohne BO-Zeile als nicht abgedeckt", () => {
    const m = engagement([boEpic({ epicId: "a", approvals: [] })]);
    expect(m.coveredCount).toBe(0);
    expect(m.approvalCount).toBe(0);
    expect(m.responseRatio).toBeNull();
  });

  it("wertet eine offene Zeile innerhalb des Zeitrahmens als rechtzeitig", () => {
    const m = engagement([boEpic({ approvals: [approval({ requestedAt: daysAgo(9) })] })]);
    expect(m.timelyCount).toBe(1);
    expect(m.overdue).toEqual([]);
  });

  it("wertet eine offene Zeile jenseits des Zeitrahmens als ueberfaellig", () => {
    const m = engagement([boEpic({ approvals: [approval({ requestedAt: daysAgo(24) })] })]);
    expect(m.timelyCount).toBe(0);
    expect(m.overdue).toHaveLength(1);
    expect(m.overdue[0]?.daysOpen).toBe(24);
  });

  it("zaehlt eine spaet entschiedene Zeile als verfehlt, aber nicht als offen", () => {
    const m = engagement([
      boEpic({
        approvals: [
          approval({ requestedAt: daysAgo(30), decidedAt: daysAgo(5), status: "approved" }),
        ],
      }),
    ]);
    expect(m.timelyCount).toBe(0);
    expect(m.overdue).toEqual([]);
  });

  it("ignoriert Zeilen aus abgeschlossenen Freigabezyklen", () => {
    const m = engagement([
      boEpic({
        approvalRevision: 2,
        approvals: [
          // Alte Runde, laengst ueberfaellig — darf nicht mehr zaehlen.
          approval({ revision: 1, requestedAt: daysAgo(90) }),
          approval({ revision: 2, requestedAt: daysAgo(2) }),
        ],
      }),
    ]);
    expect(m.approvalCount).toBe(1);
    expect(m.timelyCount).toBe(1);
    expect(m.overdue).toEqual([]);
  });

  it("nimmt das schlechtere der zwei Tiers", () => {
    // Abdeckung 100 % (gruen), Reaktion 1/2 = 50 % (rot) ⇒ rot.
    const m = engagement([
      boEpic({
        epicId: "a",
        approvals: [approval({ requestedAt: daysAgo(1) }), approval({ requestedAt: daysAgo(40) })],
      }),
    ]);
    expect(m.coverageRatio).toBe(1);
    expect(m.responseRatio).toBeCloseTo(0.5);
    expect(m.status).toBe("red");
  });

  it("sortiert die Ueberfaelligen nach Wartezeit, laengste zuerst", () => {
    const m = engagement([
      boEpic({ epicId: "a", approvals: [approval({ requestedAt: daysAgo(18) })] }),
      boEpic({ epicId: "b", approvals: [approval({ requestedAt: daysAgo(31) })] }),
    ]);
    expect(m.overdue.map((o) => o.epicId)).toEqual(["b", "a"]);
  });
});

describe("computePortfolioGuardrails — Engagement-Kopplung", () => {
  it("laesst engagement weg, wenn der Aufrufer keine BO-Daten uebergibt", () => {
    const m = computePortfolioGuardrails({ epics: [], targets: DEFAULT_GUARDRAIL_TARGETS });
    expect(m.engagement).toBeUndefined();
  });

  it("rechnet engagement mit den Targets des Tenants", () => {
    const m = computePortfolioGuardrails({
      epics: [],
      targets: DEFAULT_GUARDRAIL_TARGETS,
      engagement: { epics: [boEpic()], now: NOW },
    });
    expect(m.engagement?.coverageTarget).toBe(DEFAULT_GUARDRAIL_TARGETS.engagement.coverage);
    expect(m.engagement?.responseDays).toBe(DEFAULT_GUARDRAIL_TARGETS.engagement.responseDays);
    expect(m.engagement?.status).toBe("green");
  });
});
