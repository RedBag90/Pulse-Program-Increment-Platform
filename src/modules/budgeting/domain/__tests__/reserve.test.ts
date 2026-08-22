import { describe, it, expect } from "vitest";
import { computeReserve, carryReserveForward } from "@/modules/budgeting/domain/reserve";

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
