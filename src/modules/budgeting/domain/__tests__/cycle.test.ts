import { describe, it, expect } from "vitest";
import {
  isCycleKey,
  compareCycles,
  sortCycles,
  openCycles,
  currentCycle,
  resolveCycle,
} from "@/modules/budgeting/domain/cycle";

const H2 = new Date("2026-08-15T00:00:00Z");
const H1 = new Date("2026-02-10T00:00:00Z");

describe("isCycleKey", () => {
  it("nimmt gültige Halbjahre an", () => {
    for (const k of ["2026-H1", "2026-H2", "1999-H1"]) expect(isCycleKey(k)).toBe(true);
  });

  it("weist alles andere ab", () => {
    for (const k of ["2026-H3", "26-H1", "2026-Q1", "2026", "", null, undefined]) {
      expect(isCycleKey(k)).toBe(false);
    }
  });
});

describe("compareCycles", () => {
  it("ordnet über Jahres- und Halbjahresgrenzen", () => {
    expect(compareCycles("2026-H1", "2026-H2")).toBeLessThan(0);
    expect(compareCycles("2026-H2", "2027-H1")).toBeLessThan(0);
    expect(compareCycles("2027-H1", "2026-H2")).toBeGreaterThan(0);
    expect(compareCycles("2026-H1", "2026-H1")).toBe(0);
  });

  it("ist mit der lexikographischen Ordnung identisch — die Annahme, die zweimal im Code stand", () => {
    const keys = ["2027-H1", "2026-H2", "2026-H1", "2028-H2"];
    expect([...keys].sort(compareCycles)).toEqual([...keys].sort());
  });
});

describe("sortCycles", () => {
  it("sortiert, dedupliziert und kann rückwärts", () => {
    const keys = ["2026-H2", "2026-H1", "2026-H2", "2027-H1"];
    expect(sortCycles(keys)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
    expect(sortCycles(keys, "desc")).toEqual(["2027-H1", "2026-H2", "2026-H1"]);
  });
});

describe("openCycles", () => {
  it("gibt das laufende und das nächste Halbjahr", () => {
    expect(openCycles(H2)).toEqual(["2026-H2", "2027-H1"]);
    expect(openCycles(H1)).toEqual(["2026-H1", "2026-H2"]);
  });

  it("trägt den Jahreswechsel", () => {
    expect(openCycles(new Date("2026-11-30T00:00:00Z"))).toEqual(["2026-H2", "2027-H1"]);
  });

  it("beginnt beim laufenden — dasselbe wie currentCycle", () => {
    expect(openCycles(H2)[0]).toBe(currentCycle(H2));
  });
});

describe("resolveCycle", () => {
  it("nimmt einen gültigen, offenen Wert an", () => {
    expect(resolveCycle("2027-H1", H2).cycleKey).toBe("2027-H1");
  });

  it("fällt stumm auf das laufende zurück", () => {
    // Ein Halbjahr aus einer URL ist keine Fehlermeldung wert.
    for (const raw of [undefined, null, "", "Unsinn", "2020-H1", "2030-H2"]) {
      expect(resolveCycle(raw, H2).cycleKey).toBe("2026-H2");
    }
  });

  it("liefert die Auswahl für den Umschalter mit", () => {
    const { options } = resolveCycle(undefined, H2);
    expect(options.map((o) => o.key)).toEqual(["2026-H2", "2027-H1"]);
    expect(options[0]?.label).toBeTruthy();
  });
});
