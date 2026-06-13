import { describe, it, expect } from "vitest";
import { buildEpicsListModel } from "@/server/views/portfolio-epics-list";

const epic = (over: Partial<Parameters<typeof buildEpicsListModel>[0]["epics"][number]>) => ({
  id: "e1",
  title: "Epic",
  stageGate: "L0",
  status: "draft",
  approvalPhase: null,
  approvalRevision: 1,
  ownerId: null,
  valueStream: null,
  needsSteeringAttention: false,
  stagedForBudgeting: false,
  businessCase: null,
  businessCaseApprovedAt: null,
  plannedStartAt: null,
  plannedEndAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  kpis: [],
  epicApprovals: [],
  childFeatureCount: 0,
  completedChildFeatureCount: 0,
  epicType: null,
  investmentHorizon: null,
  ...over,
});

describe("buildEpicsListModel", () => {
  it("counts every stage gate even when empty", () => {
    const m = buildEpicsListModel({
      epics: [epic({ id: "a", stageGate: "L0" }), epic({ id: "b", stageGate: "L2" })],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    expect(m.funnelCounts).toEqual({ L0: 1, L1: 0, L2: 1, L3: 0, L4: 0, L5: 0 });
  });

  it("derives economics from the business case totals helper", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "with-bc",
          businessCase: {
            current: {
              costSlices: [{ amount: 100000 }, { amount: 50000 }],
              oneTimeBenefit: 80000,
              recurringBenefit: 400000,
            },
            history: [],
          },
        }),
        epic({ id: "no-bc", businessCase: null }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    const withBc = m.rows.find((r) => r.id === "with-bc")!;
    expect(withBc.economics).toEqual({
      implementationCost: 150000,
      oneTimeBenefit: 80000,
      recurringBenefitYear: 400000,
    });
    const noBc = m.rows.find((r) => r.id === "no-bc")!;
    expect(noBc.economics).toEqual({
      implementationCost: null,
      oneTimeBenefit: null,
      recurringBenefitYear: null,
    });
  });

  it("computes mean KPI progress and RAG tier", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "kpi-mid",
          kpis: [
            { baseline: 0, target: 10, current: 5 },
            { baseline: 0, target: 10, current: 3 },
          ],
        }),
        epic({ id: "kpi-none", kpis: [] }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    const mid = m.rows.find((r) => r.id === "kpi-mid")!;
    expect(mid.kpiProgress).toBeCloseTo(0.4, 5);
    expect(mid.kpiTier).toBe("amber");
    expect(mid.kpiCount).toBe(2);
    const none = m.rows.find((r) => r.id === "kpi-none")!;
    expect(none.kpiProgress).toBeNull();
    expect(none.kpiTier).toBeNull();
    expect(none.kpiCount).toBe(0);
  });

  it("counts pending approvals only on the active revision", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "e",
          approvalRevision: 2,
          epicApprovals: [
            { revision: 1, status: "pending" }, // stale — ignored
            { revision: 2, status: "pending" },
            { revision: 2, status: "approved" },
            { revision: 2, status: "pending" },
          ],
        }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    expect(m.rows[0]!.pendingApprovalsCount).toBe(2);
  });

  it("resolves ownerLabel from the labels map", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({ id: "e", ownerId: "u1" }),
        epic({ id: "e2", ownerId: "u-missing" }),
        epic({ id: "e3", ownerId: null }),
      ],
      valueStreams: [],
      userLabels: { u1: "Alice" },
      stageGatesEnabled: true,
    });
    expect(m.rows[0]!.ownerLabel).toBe("Alice");
    expect(m.rows[1]!.ownerLabel).toBeNull(); // missing label → null, not the raw id
    expect(m.rows[2]!.ownerLabel).toBeNull();
  });

  it("keeps approvalPhase and status independent (two pills)", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "e",
          status: "draft", // QS status
          approvalPhase: "business_case", // distinct workflow phase
        }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    expect(m.rows[0]!.status).toBe("draft");
    expect(m.rows[0]!.approvalPhase).toBe("business_case");
  });

  it("emits distinct owner + status filter options from the dataset", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({ id: "a", ownerId: "u1", status: "draft" }),
        epic({ id: "b", ownerId: "u1", status: "in_review" }),
        epic({ id: "c", ownerId: "u2", status: "draft" }),
      ],
      valueStreams: [{ id: "vs1", name: "Retail" }],
      userLabels: { u1: "Alice", u2: "Bob" },
      stageGatesEnabled: true,
    });
    expect(m.ownerOptions.map((o) => o.id).sort()).toEqual(["u1", "u2"]);
    expect(m.statusOptions.sort()).toEqual(["draft", "in_review"]);
    expect(m.valueStreamOptions).toEqual([{ id: "vs1", name: "Retail" }]);
  });
});
