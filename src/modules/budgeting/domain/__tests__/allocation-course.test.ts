import { describe, it, expect } from "vitest";

import { buildAllocationCourse } from "@/modules/budgeting/domain/allocation-course";
import type { AllocationState } from "@/modules/budgeting/domain/allocation-state";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"].map((label, i) => ({
  key: `2026-0${i + 1}`,
  label,
}));

/** Kurzschreibweise: "nnccvv" → sechs Monatszustände. */
const states = (s: string): AllocationState[] =>
  [...s].map((c) => (c === "n" ? "notStarted" : c === "c" ? "committed" : "consumed"));

describe("buildAllocationCourse", () => {
  // Der Kern der Aussage: die Säulenhöhe bewegt sich nicht, nur ihre Füllung.
  it("hält die Monatssumme über das Halbjahr konstant", () => {
    const c = buildAllocationCourse(MONTHS, [
      { amount: 2_400_000, states: states("nnccvv") },
      { amount: 600_000, states: states("nnnnnn") },
    ]);

    expect(c.points).toHaveLength(6);
    expect(new Set(c.points.map((p) => p.total))).toEqual(new Set([500_000]));
    expect(c.perMonth).toBe(500_000);
  });

  it("verschiebt die Zusammensetzung Monat für Monat", () => {
    const c = buildAllocationCourse(MONTHS, [{ amount: 600, states: states("nnccvv") }]);
    expect(c.points.map((p) => p.byState.notStarted)).toEqual([100, 100, 0, 0, 0, 0]);
    expect(c.points.map((p) => p.byState.committed)).toEqual([0, 0, 100, 100, 0, 0]);
    expect(c.points.map((p) => p.byState.consumed)).toEqual([0, 0, 0, 0, 100, 100]);
  });

  it("summiert mehrere Epics je Monat und Zustand", () => {
    const c = buildAllocationCourse(MONTHS, [
      { amount: 600, states: states("cccccc") },
      { amount: 1_200, states: states("cccccc") },
    ]);
    expect(c.points[0]!.byState.committed).toBe(300);
  });

  it("stellt Soll und Ist zum Stichmonat gegenüber", () => {
    // 600 € über sechs Monate = 100 €/Monat. Im vierten Monat (Index 3)
    // sollten 4/6 des Monatsbetrags nicht mehr unangetastet sein.
    const c = buildAllocationCourse(MONTHS, [{ amount: 600, states: states("nncvvv") }], 3);
    expect(c.perMonth).toBe(100);
    expect(c.expectedByToday).toBeCloseTo((100 * 4) / 6, 6);
    expect(c.actualByToday).toBe(100); // im vierten Monat verbraucht
  });

  it("lässt Soll und Ist weg, wenn heute außerhalb des Fensters liegt", () => {
    const c = buildAllocationCourse(MONTHS, [{ amount: 600, states: states("nnnnnn") }], -1);
    expect(c.expectedByToday).toBeNull();
    expect(c.actualByToday).toBeNull();
  });

  // Eine Zustands-Reihe falscher Länge ist ein Aufruferfehler, kein Datenrauschen.
  it("lässt Epics mit unpassender Zustands-Reihe heraus", () => {
    const c = buildAllocationCourse(MONTHS, [
      { amount: 600, states: states("nnn") },
      { amount: 1_200, states: states("cccccc") },
    ]);
    expect(c.perMonth).toBe(200);
    expect(c.points[0]!.byState.notStarted).toBe(0);
  });

  it("ignoriert Epics ohne Zuteilung", () => {
    const c = buildAllocationCourse(MONTHS, [{ amount: 0, states: states("cccccc") }]);
    expect(c.perMonth).toBe(0);
    expect(c.points.every((p) => p.total === 0)).toBe(true);
  });

  it("leere Achse ergibt einen leeren Verlauf", () => {
    const c = buildAllocationCourse([], [{ amount: 600, states: [] }]);
    expect(c).toEqual({ points: [], perMonth: 0, expectedByToday: null, actualByToday: null });
  });
});
