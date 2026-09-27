import { describe, it, expect } from "vitest";
import {
  foldChangeMoney,
  changeTotal,
  NO_CHANGE,
  type ChangeMoneyRows,
} from "@/modules/budgeting/domain/change-money";

/**
 * **Das Veränderungsgeld** — Portfolio-Zuteilung und ART-Rahmen, einmal
 * gefaltet. Jede Fläche liest diese Zahlen; also werden sie hier geprüft.
 */

const H2 = "2026-H2";
const H1 = "2026-H1";

const epic = (
  artId: string | null,
  valueStreamId: string | null,
  amount: number | null,
  cycleKey = H2,
) => ({
  kind: "epic",
  artId,
  valueStreamId,
  finalAmount: amount,
  cycleKey,
});
const rahmen = (id: string, artId: string, active = true) => ({
  id,
  kind: "art_change",
  artId,
  active,
});

function rows(over: Partial<ChangeMoneyRows> = {}): ChangeMoneyRows {
  return { candidates: [], items: [], awards: [], epicAllocations: [], ownWork: [], ...over };
}

describe("foldChangeMoney — ein ART", () => {
  it("Portfolio, Rahmen und seine drei Teile", () => {
    const m = foldChangeMoney(
      rows({
        candidates: [epic("a1", "vs1", 60_000), epic("a1", "vs1", 40_000)],
        items: [rahmen("p1", "a1")],
        awards: [{ rtbItemId: "p1", cycleKey: H2, amount: 50_000 }],
        epicAllocations: [{ artId: "a1", cycleKey: H2, amount: 20_000 }],
        ownWork: [{ artId: "a1", cycleKey: H2, amount: 5_000 }],
      }),
    );
    const c = m.art("a1", H2);
    expect(c).toEqual({
      portfolio: 100_000,
      frame: 50_000,
      toEpics: 20_000,
      toOwnWork: 5_000,
      open: 25_000,
    });
    expect(changeTotal(c)).toBe(150_000);
  });

  // Der Filter, der schon einmal gefehlt hat.
  it("nur aktive ART-Rahmen zählen", () => {
    const m = foldChangeMoney(
      rows({
        items: [rahmen("p1", "a1", false)],
        awards: [{ rtbItemId: "p1", cycleKey: H2, amount: 50_000 }],
      }),
    );
    expect(m.art("a1", H2).frame).toBe(0);
  });

  it("Betrieb gehört nicht hinein (REQ-10)", () => {
    const m = foldChangeMoney(
      rows({
        items: [{ id: "b1", kind: "run", artId: "a1", active: true }],
        awards: [{ rtbItemId: "b1", cycleKey: H2, amount: 30_000 }],
      }),
    );
    expect(m.art("a1", H2)).toEqual(NO_CHANGE);
  });

  it("offene Kandidaten und Run-Kandidaten zählen nicht", () => {
    const m = foldChangeMoney(
      rows({
        candidates: [epic("a1", "vs1", null), { ...epic("a1", "vs1", 9_000), kind: "rtb" }],
      }),
    );
    expect(m.art("a1", H2).portfolio).toBe(0);
  });

  it("ein negativer Rest bleibt negativ — ein gekürzter Rahmen wird nicht versteckt", () => {
    const m = foldChangeMoney(
      rows({
        items: [rahmen("p1", "a1")],
        awards: [{ rtbItemId: "p1", cycleKey: H2, amount: 40_000 }],
        epicAllocations: [{ artId: "a1", cycleKey: H2, amount: 50_000 }],
      }),
    );
    expect(m.art("a1", H2).open).toBe(-10_000);
  });

  it("je Halbjahr getrennt; das ART-Budget nur, wo Portfolio oder Rahmen liegt", () => {
    const m = foldChangeMoney(
      rows({
        candidates: [epic("a1", "vs1", 10_000, H1)],
        items: [rahmen("p1", "a1")],
        awards: [{ rtbItemId: "p1", cycleKey: H2, amount: 7_000 }],
        // Eine Zuteilung in einem Halbjahr ohne Rahmen macht kein Budget.
        epicAllocations: [{ artId: "a1", cycleKey: "2027-H1", amount: 1_000 }],
      }),
    );
    expect(m.artTotalByCycle("a1")).toEqual({ [H1]: 10_000, [H2]: 7_000 });
    expect(Object.keys(m.artByCycle("a1")).sort()).toEqual([H1, H2, "2027-H1"]);
  });
});

describe("foldChangeMoney — ein Wertstrom", () => {
  const m = foldChangeMoney(
    rows({
      candidates: [
        epic("a1", "vs1", 60_000),
        // Ein Portfolio-Epic ohne ART gehört dem Wertstrom trotzdem.
        epic(null, "vs1", 40_000),
      ],
      items: [rahmen("p1", "a1"), rahmen("p2", "a2"), rahmen("p3", "a3")],
      awards: [
        { rtbItemId: "p1", cycleKey: H2, amount: 35_000 },
        { rtbItemId: "p2", cycleKey: H2, amount: 15_000 },
        { rtbItemId: "p3", cycleKey: H2, amount: 30_000 },
      ],
      epicAllocations: [{ artId: "a1", cycleKey: H2, amount: 20_000 }],
      ownWork: [{ artId: "a1", cycleKey: H2, amount: 5_000 }],
    }),
  );

  it("Portfolio über den Wertstrom der Kandidaten, Rahmen Σ über seine ARTs", () => {
    expect(m.valueStream("vs1", ["a1", "a2"], H2)).toEqual({
      portfolio: 100_000,
      frame: 50_000,
      toEpics: 20_000,
      toOwnWork: 5_000,
      open: 25_000,
    });
  });

  it("ein Wertstrom nur mit ART-Rahmen hat kein Portfolio-Geld", () => {
    expect(m.valueStream("vs2", ["a3"], H2)).toMatchObject({ portfolio: 0, open: 30_000 });
  });

  it("die Portfolio-Summe je Halbjahr, nur Wertströme mit Geld", () => {
    expect(m.valueStreamPortfolioByCycle("vs1")).toEqual({ [H2]: 100_000 });
    expect(m.valueStreamIds()).toEqual(["vs1"]);
  });
});
