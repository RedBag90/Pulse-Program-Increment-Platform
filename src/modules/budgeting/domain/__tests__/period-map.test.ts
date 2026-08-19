import { describe, it, expect } from "vitest";
import { sumPeriods, addPeriod, remainingByPeriod } from "@/modules/budgeting/domain/period-map";

describe("sumPeriods", () => {
  it("summiert alle Perioden einer Karte", () => {
    expect(sumPeriods({ "2026-H1": 100, "2026-H2": 250 })).toBe(350);
  });

  it("leere Karte ist 0", () => {
    expect(sumPeriods({})).toBe(0);
  });

  it("negative Zellen zaehlen mit (Ueberverteilung ist kein Fehler)", () => {
    expect(sumPeriods({ "2026-H1": 100, "2026-H2": -40 })).toBe(60);
  });
});

describe("addPeriod", () => {
  it("akkumuliert auf einen bestehenden Key", () => {
    const target = { "2026-H1": 100 };
    addPeriod(target, "2026-H1", 50);
    expect(target).toEqual({ "2026-H1": 150 });
  });

  it("legt einen neuen Key an", () => {
    const target: Record<string, number> = {};
    addPeriod(target, "2027-H2", 20);
    expect(target).toEqual({ "2027-H2": 20 });
  });

  it("Nullbetrag legt KEINE Zelle an — 'Key vorhanden' heisst 'hat Daten'", () => {
    const target: Record<string, number> = {};
    addPeriod(target, "2026-H1", 0);
    expect(Object.keys(target)).toEqual([]);
  });
});

describe("remainingByPeriod", () => {
  const keys = ["2026-H1", "2026-H2"];

  it("Budget minus Summe der Kinder je Periode", () => {
    expect(
      remainingByPeriod(
        { "2026-H1": 1000, "2026-H2": 800 },
        [{ "2026-H1": 300 }, { "2026-H1": 200, "2026-H2": 500 }],
        keys,
      ),
    ).toEqual({ "2026-H1": 500, "2026-H2": 300 });
  });

  it("Ueberverteilung ergibt einen negativen Rest", () => {
    expect(remainingByPeriod({ "2026-H1": 100 }, [{ "2026-H1": 250 }], keys)).toEqual({
      "2026-H1": -150,
      "2026-H2": 0,
    });
  });

  it("belegt JEDE angefragte Periode, auch wenn weder Budget noch Kind sie kennt", () => {
    expect(Object.keys(remainingByPeriod({}, [], keys))).toEqual(keys);
  });

  it("ignoriert Perioden ausserhalb der angefragten Keys", () => {
    expect(remainingByPeriod({ "2030-H1": 999 }, [{ "2030-H1": 111 }], ["2026-H1"])).toEqual({
      "2026-H1": 0,
    });
  });
});
