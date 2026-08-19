import { describe, it, expect } from "vitest";
import { buildBudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import { buildHalfYearAxis } from "@/modules/core/kernel/domain/calendar";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const axis = buildHalfYearAxis(utc("2026-01-01"), utc("2026-12-31")); // 2026-H1, 2026-H2

const epic = (over: Partial<BudgetEpicView> = {}): BudgetEpicView => ({
  id: "e1",
  title: "Epic 1",
  valueStreamId: "vs1",
  valueStream: "Wertstrom 1",
  isHypothesisOnly: false,
  costSlices: [100, 200],
  hypothesisBudget: 0,
  startKey: "2026-H1",
  allocations: {},
  priority: 0,
  ...over,
});

describe("buildBudgetingBoardModel", () => {
  it("sortiert die Zeilen nach Prioritaet und laesst Gleichstand stabil", () => {
    const model = buildBudgetingBoardModel({
      epics: [
        epic({ id: "c", priority: 2 }),
        epic({ id: "a", priority: 1 }),
        epic({ id: "b", priority: 1 }),
      ],
      axis,
      pool: {},
    });
    expect(model.rows.map((r) => r.epic.id)).toEqual(["a", "b", "c"]);
  });

  it("legt je Zeile den abgeleiteten Bedarf bei (REQ-B2)", () => {
    const model = buildBudgetingBoardModel({ epics: [epic()], axis, pool: {} });
    expect(model.rows[0]!.requested).toEqual({ "2026-H1": 100, "2026-H2": 200 });
  });

  it("Hypothesen-Epic: das Festbudget landet in der Startperiode", () => {
    const model = buildBudgetingBoardModel({
      epics: [epic({ isHypothesisOnly: true, hypothesisBudget: 50_000, startKey: "2026-H2" })],
      axis,
      pool: {},
    });
    expect(model.rows[0]!.requested).toEqual({ "2026-H2": 50_000 });
  });

  it("Verbleibend = Topf minus Zuteilungen, negativ bei Ueberallokation (REQ-B4)", () => {
    const model = buildBudgetingBoardModel({
      epics: [epic({ allocations: { "2026-H1": 700 } })],
      axis,
      pool: { "2026-H1": 500, "2026-H2": 300 },
    });
    expect(model.remaining).toEqual({ "2026-H1": -200, "2026-H2": 300 });
  });

  it("rollt je Wertstrom auf und pivotiert die Chart-Zeilen (REQ-B6)", () => {
    const model = buildBudgetingBoardModel({
      epics: [
        epic({ id: "a", allocations: { "2026-H1": 100 } }),
        epic({ id: "b", valueStreamId: null, valueStream: null, allocations: { "2026-H1": 40 } }),
      ],
      axis,
      pool: {},
    });

    expect(model.rollup).toHaveLength(2);
    expect(model.chartRows[0]).toMatchObject({
      label: axis.periods[0]!.label,
      "Wertstrom 1": 100,
      "Ohne Wertstrom": 40,
    });
  });

  it("leeres Board: Spalten bleiben, alles andere ist leer bzw. der volle Topf", () => {
    const model = buildBudgetingBoardModel({ epics: [], axis, pool: { "2026-H1": 900 } });
    expect(model.rows).toEqual([]);
    expect(model.rollup).toEqual([]);
    expect(model.periods).toHaveLength(2);
    expect(model.remaining).toEqual({ "2026-H1": 900, "2026-H2": 0 });
  });

  it("mutiert die Eingabe nicht (der Client faltet dieselbe Liste mehrfach)", () => {
    const epics = [epic({ id: "z", priority: 9 }), epic({ id: "a", priority: 1 })];
    buildBudgetingBoardModel({ epics, axis, pool: {} });
    expect(epics.map((e) => e.id)).toEqual(["z", "a"]);
  });
});
