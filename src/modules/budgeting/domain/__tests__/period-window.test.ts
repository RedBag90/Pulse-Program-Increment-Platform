import { describe, it, expect } from "vitest";
import {
  forecastAxis,
  budgetPlusLoadPeriods,
  occupiedWindow,
  computeDisplayPeriods,
} from "@/modules/budgeting/domain/period-window";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const keys = (ps: readonly { key: string }[]) => ps.map((p) => p.key);

describe("forecastAxis", () => {
  it("spannt lueckenlos vom fruehesten Start bis zum spaetesten Bedarfsende", () => {
    const axis = forecastAxis([{ startKey: "2026-H1", spanPeriods: 3 }], [], utc("2026-03-01"));
    expect(keys(axis.periods)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
    expect(axis.count).toBe(3);
  });

  it("zieht den Horizont nach vorne, wenn der Topf frueher beginnt als jedes Epic", () => {
    const axis = forecastAxis(
      [{ startKey: "2027-H1", spanPeriods: 1 }],
      ["2026-H2"],
      utc("2026-03-01"),
    );
    expect(keys(axis.periods)).toEqual(["2026-H2", "2027-H1"]);
  });

  it("zieht den Horizont nach hinten, wenn der Topf spaeter endet als jeder Bedarf", () => {
    const axis = forecastAxis(
      [{ startKey: "2026-H1", spanPeriods: 1 }],
      ["2027-H2"],
      utc("2026-03-01"),
    );
    expect(keys(axis.periods)).toEqual(["2026-H1", "2026-H2", "2027-H1", "2027-H2"]);
  });

  it("ohne Epics und ohne Topf faellt der Horizont auf das Halbjahr von now", () => {
    expect(keys(forecastAxis([], [], utc("2026-09-15")).periods)).toEqual(["2026-H2"]);
  });

  it("span < 1 belegt trotzdem genau ein Halbjahr", () => {
    expect(
      keys(forecastAxis([{ startKey: "2026-H1", spanPeriods: 0 }], [], utc("2026-01-01")).periods),
    ).toEqual(["2026-H1"]);
  });
});

describe("budgetPlusLoadPeriods", () => {
  it("vereinigt Budget-Perioden mit den Halbjahren der Feature-PIs, sortiert", () => {
    expect(keys(budgetPlusLoadPeriods(["2026-H2", "2026-H1"], [utc("2027-02-01")]))).toEqual([
      "2026-H1",
      "2026-H2",
      "2027-H1",
    ]);
  });

  it("dedupliziert eine PI-Periode, die schon Budget hat", () => {
    expect(
      keys(budgetPlusLoadPeriods(["2026-H1"], [utc("2026-03-01"), utc("2026-05-01")])),
    ).toEqual(["2026-H1"]);
  });

  it("Last ohne Budget bleibt sichtbar", () => {
    expect(keys(budgetPlusLoadPeriods([], [utc("2026-08-01")]))).toEqual(["2026-H2"]);
  });
});

describe("occupiedWindow", () => {
  it("Raster enthaelt NUR belegte Perioden (kein Zero-Padding), Achse ist lueckenlos", () => {
    const { periods, axis } = occupiedWindow({ "2026-H1": 100, "2027-H1": 50 }, utc("2026-01-01"));
    expect(periods).toEqual([
      { key: "2026-H1", label: "H1 2026", total: 100 },
      { key: "2027-H1", label: "H1 2027", total: 50 },
    ]);
    expect(keys(axis.periods)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
  });

  it("die Achse verwirft nichts, was das Raster zeigt", () => {
    const { periods, axis } = occupiedWindow({ "2026-H2": 1, "2028-H1": 2 }, utc("2026-01-01"));
    const axisKeys = new Set(keys(axis.periods));
    expect(keys(periods).every((k) => axisKeys.has(k))).toBe(true);
  });

  it("ohne Daten spannen beide ueber den Fallback", () => {
    const { periods, axis } = occupiedWindow({}, utc("2026-09-01"));
    expect(periods).toEqual([]);
    expect(keys(axis.periods)).toEqual(["2026-H2"]);
  });
});

describe("computeDisplayPeriods", () => {
  it("ankert auf Vorgaenger + Zyklus + spaetere Perioden mit Daten", () => {
    expect(
      computeDisplayPeriods({
        cycleKey: "2026-H2",
        periods: [{ key: "2025-H1" }, { key: "2026-H1" }, { key: "2026-H2" }, { key: "2027-H1" }],
      }),
    ).toEqual([
      { key: "2026-H1", label: "H1 2026", isCurrent: false },
      { key: "2026-H2", label: "H2 2026", isCurrent: true },
      { key: "2027-H1", label: "H1 2027", isCurrent: false },
    ]);
  });

  it("Zyklus und Vorgaenger erscheinen auch ohne Daten", () => {
    expect(keys(computeDisplayPeriods({ cycleKey: "2026-H1", periods: [] }))).toEqual([
      "2025-H2",
      "2026-H1",
    ]);
  });
});
