import { describe, it, expect } from "vitest";
import { buildBudgetPlanRevisionModel } from "@/modules/budgeting/server/views/budget-plan-revision";
import type { BudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";

const snapshot = (over: Partial<BudgetPlanSnapshot> = {}): BudgetPlanSnapshot => ({
  cycleKey: "2026-H1",
  cycleLabel: "H1 2026",
  capturedAt: "2026-03-15T00:00:00.000Z",
  periods: [
    { key: "2026-H1", label: "H1 2026", total: 100 },
    { key: "2026-H2", label: "H2 2026", total: 50 },
  ],
  budgetPoolByPeriod: { "2026-H1": 1000, "2026-H2": 800 },
  epics: [],
  valueStreams: [],
  arts: [],
  cycleBudgetSum: 0,
  followBudgetSum: 0,
  ...over,
});

const epic = (cycleBudget: number, total: number, features = 0) => ({
  epicId: "e1",
  title: "Epic",
  valueStreamId: null,
  valueStreamName: null,
  priority: 0,
  allocations: {},
  total,
  cycleBudget,
  cycleFeatures: Array.from({ length: features }, (_, i) => ({
    featureId: `f${i}`,
    title: "Feature",
    artId: "a",
    artName: "ART",
    piId: "pi",
    piName: "PI",
    piStartDate: "2026-02-01",
    piEndDate: "2026-04-01",
    status: "open",
    wsjfJobSize: null,
  })),
});

describe("buildBudgetPlanRevisionModel", () => {
  it("uebernimmt die eingefrorenen Zyklus- und Folgesummen (REQ-R4)", () => {
    const model = buildBudgetPlanRevisionModel(
      snapshot({ cycleBudgetSum: 100_000, followBudgetSum: 60_000 }),
    );
    expect(model.cycleBudgetSum).toBe(100_000);
    expect(model.followBudgetSum).toBe(60_000);
  });

  it("faellt fuer ALTE Snapshots ohne Summen auf die Epic-Liste zurueck", () => {
    const s = snapshot({ epics: [epic(40, 100)] });
    delete (s as Partial<BudgetPlanSnapshot>).cycleBudgetSum;
    delete (s as Partial<BudgetPlanSnapshot>).followBudgetSum;

    const model = buildBudgetPlanRevisionModel(s);
    expect(model.cycleBudgetSum).toBe(40);
    expect(model.followBudgetSum).toBe(60);
  });

  it("summiert den eingefrorenen Topf", () => {
    expect(buildBudgetPlanRevisionModel(snapshot()).poolSum).toBe(1800);
  });

  it("zaehlt die Features im Zyklus ueber alle Epics", () => {
    const model = buildBudgetPlanRevisionModel(snapshot({ epics: [epic(0, 0, 2), epic(0, 0, 1)] }));
    expect(model.cycleFeatureCount).toBe(3);
  });

  it("sichtbare Spalten: Vorgaenger + Zyklus + spaetere mit Daten (REQ-R5)", () => {
    const model = buildBudgetPlanRevisionModel(snapshot());
    expect(model.displayPeriods.map((p) => p.key)).toEqual(["2025-H2", "2026-H1", "2026-H2"]);
    expect(model.displayPeriods.filter((p) => p.isCurrent).map((p) => p.key)).toEqual(["2026-H1"]);
  });

  it("Folgeperioden-Zaehler ist die Spaltenzahl ohne den Zyklus, nie negativ", () => {
    expect(buildBudgetPlanRevisionModel(snapshot()).followPeriodCount).toBe(1);
    expect(buildBudgetPlanRevisionModel(snapshot({ periods: [] })).followPeriodCount).toBe(0);
  });
});
