import { describe, it, expect } from "vitest";
import {
  computeReserve,
  carryReserveForward,
  pickCarriedReserve,
} from "@/modules/budgeting/domain/reserve";

describe("computeReserve", () => {
  it("Nordwerk Gruppe A: 2,05 Mio − 1,9 Mio = 150k, Rest < günstigstem (200k) ⇒ vollständig verteilt", () => {
    expect(computeReserve(2_050_000, 1_900_000, 200_000)).toEqual({
      reserve: 150_000,
      fullyDistributed: true,
    });
  });

  it("Rest ≥ günstigstem ⇒ nicht vollständig verteilt", () => {
    expect(computeReserve(1_000_000, 700_000, 200_000)).toEqual({
      reserve: 300_000,
      fullyDistributed: false,
    });
  });

  it("kein finanzierbares Epic offen (cheapest ≤ 0) ⇒ immer vollständig verteilt", () => {
    expect(computeReserve(500, 0, 0)).toEqual({ reserve: 500, fullyDistributed: true });
  });
});

describe("carryReserveForward", () => {
  it("addiert die Reserve auf den Folge-Topf", () => {
    expect(carryReserveForward(2_400_000, 150_000)).toBe(2_550_000);
  });

  it("negative Reserve (Überverteilung) wird nicht übertragen", () => {
    expect(carryReserveForward(1000, -50)).toBe(1000);
  });
});

describe("pickCarriedReserve", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("nimmt die zeitlich vorherige Kachel — nicht die mit dem höchsten cycleKey", () => {
    const closed = [
      { cycleKey: "2027-H1", startDate: d("2027-01-01"), reserveAmount: 1_940_000 },
      { cycleKey: "2026-H1", startDate: d("2026-01-01"), reserveAmount: 150_000 },
    ];
    expect(pickCarriedReserve(closed, d("2026-07-01"))).toEqual({
      amount: 150_000,
      fromCycleKey: "2026-H1",
    });
  });

  it("ignoriert Kacheln, die erst nach dem neuen Start beginnen", () => {
    const closed = [{ cycleKey: "2027-H1", startDate: d("2027-01-01"), reserveAmount: 1_940_000 }];
    expect(pickCarriedReserve(closed, d("2026-07-01"))).toBeNull();
  });

  it("ignoriert Kacheln ohne offene Reserve", () => {
    const closed = [
      { cycleKey: "2026-H1", startDate: d("2026-01-01"), reserveAmount: 0 },
      { cycleKey: "2025-H2", startDate: d("2025-07-01"), reserveAmount: 40_000 },
    ];
    expect(pickCarriedReserve(closed, d("2026-07-01"))).toEqual({
      amount: 40_000,
      fromCycleKey: "2025-H2",
    });
  });

  it("ohne Start-Termin (Legacy-Pfad) die jüngste abgeschlossene Kachel", () => {
    const closed = [
      { cycleKey: "2026-H1", startDate: d("2026-01-01"), reserveAmount: 150_000 },
      { cycleKey: "2027-H1", startDate: d("2027-01-01"), reserveAmount: 1_940_000 },
    ];
    expect(pickCarriedReserve(closed, null)).toEqual({
      amount: 1_940_000,
      fromCycleKey: "2027-H1",
    });
  });

  it("kein Kandidat ⇒ null", () => {
    expect(pickCarriedReserve([], d("2026-07-01"))).toBeNull();
  });
});
