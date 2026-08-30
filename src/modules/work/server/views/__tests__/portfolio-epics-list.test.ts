import { describe, it, expect } from "vitest";
import { buildEpicsListModel } from "@/modules/work/server/views/portfolio-epics-list";

type KpiInput = Parameters<typeof buildEpicsListModel>[0]["epics"][number]["kpis"][number];
const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
  baseline: 0,
  target: 10,
  current: null,
  valuePerUnit: null,
  benefitKind: "recurring",
  recurringInterval: "yearly",
  ...over,
});

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
  approvedAt: null,
  plannedStartAt: null,
  plannedEndAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  kpis: [],
  childFeatureCount: 0,
  completedChildFeatureCount: 0,
  implementationCompletedAt: null,
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

  it("derives cost from the business case and benefit from the KPIs", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "with-bc",
          businessCase: {
            current: { costSlices: [{ amount: 100000 }, { amount: 50000 }] },
            history: [],
          },
          // Nutzen kommt aus den KPIs: one-time 8×10000=80000, recurring 40×10000=400000 p.a.
          kpis: [
            kpi({ baseline: 0, target: 8, valuePerUnit: 10000, benefitKind: "one_time" }),
            kpi({ baseline: 0, target: 40, valuePerUnit: 10000, benefitKind: "recurring" }),
          ],
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

  it("annualises a monthly recurring KPI for the list benefit (×12)", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "monthly",
          businessCase: { current: { costSlices: [{ amount: 1 }] }, history: [] },
          kpis: [
            kpi({
              baseline: 0,
              target: 10,
              valuePerUnit: 1000,
              benefitKind: "recurring",
              recurringInterval: "monthly",
            }),
          ],
        }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    // 10×1000 = 10000 p.M. → 120000 p.a.
    expect(m.rows[0]!.economics.recurringBenefitYear).toBe(120000);
  });

  it("computes mean KPI progress and RAG tier", () => {
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "kpi-mid",
          kpis: [kpi({ target: 10, current: 5 }), kpi({ target: 10, current: 3 })],
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

  it("zaehlt die offenen Abnehmer des laufenden Reifegrad-Antrags", () => {
    // Seit die inhaltlichen Freigaben in die Reifegrad-Schritte aufgegangen
    // sind, gibt es genau einen Vorgang — und seine offenen Zeilen sind die
    // „offenen Freigaben" des Epics.
    const m = buildEpicsListModel({
      epics: [
        epic({
          id: "e",
          pendingGateRequest: { toGate: "L3.1", pendingCount: 2, totalCount: 5 },
        }),
        epic({ id: "ohne" }),
      ],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    expect(m.rows.find((r) => r.id === "e")!.pendingApprovalsCount).toBe(2);
    expect(m.rows.find((r) => r.id === "ohne")!.pendingApprovalsCount).toBe(0);
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

  it("setzt nextStep: L0 ohne Hypothese → 'Benefit Hypothese ausarbeiten', L5 → null", () => {
    const m = buildEpicsListModel({
      epics: [epic({ id: "l0", stageGate: "L0" }), epic({ id: "l5", stageGate: "L5" })],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    const l0 = m.rows.find((r) => r.id === "l0")!;
    expect(l0.nextStep?.title).toMatch(/Benefit Hypothese/i);
    expect(l0.nextStep?.cta).toMatchObject({
      kind: "link",
      href: expect.stringContaining("benefit-hypothesis"),
    });
    expect(m.rows.find((r) => r.id === "l5")!.nextStep).toBeNull();
  });

  it("haelt QS-Status und Reifegrad getrennt (zwei Pillen)", () => {
    const m = buildEpicsListModel({
      epics: [epic({ id: "e", status: "draft", stageGate: "L2" })],
      valueStreams: [],
      userLabels: {},
      stageGatesEnabled: true,
    });
    expect(m.rows[0]!.status).toBe("draft");
    expect(m.rows[0]!.stageGate).toBe("L2");
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
