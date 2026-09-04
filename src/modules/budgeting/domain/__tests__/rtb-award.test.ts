import { describe, it, expect } from "vitest";
import { proportionalAwards, awardSplitDeniedReason } from "@/modules/budgeting/domain/rtb-award";

const items = [
  { id: "betrieb", ask: 100_000 },
  { id: "rahmen-a", ask: 60_000 },
  { id: "rahmen-b", ask: 40_000 },
];

describe("proportionalAwards", () => {
  it("gibt jeder Position ihren Richtwert, wenn der Zuspruch den Antrag deckt", () => {
    expect(proportionalAwards(items, 200_000)).toEqual({
      betrieb: 100_000,
      "rahmen-a": 60_000,
      "rahmen-b": 40_000,
    });
  });

  it("kürzt alle im selben Verhältnis, wenn weniger da ist", () => {
    const out = proportionalAwards(items, 100_000);
    expect(out).toEqual({ betrieb: 50_000, "rahmen-a": 30_000, "rahmen-b": 20_000 });
  });

  it("trifft die Summe exakt — der Rundungsrest geht an die größte Position", () => {
    const out = proportionalAwards(items, 100_001);
    expect(Object.values(out).reduce((s, v) => s + v, 0)).toBe(100_001);
    // 100.001 / 2 lässt sich nicht glatt dritteln; der Rest landet beim Betrieb.
    expect(out.betrieb).toBeGreaterThan(50_000);
  });

  it("teilt ohne Richtwerte zu gleichen Teilen", () => {
    const out = proportionalAwards(
      [
        { id: "a", ask: 0 },
        { id: "b", ask: 0 },
      ],
      1_000,
    );
    expect(out).toEqual({ a: 500, b: 500 });
  });

  it("gibt bei nichts nichts", () => {
    expect(proportionalAwards(items, 0)).toEqual({
      betrieb: 0,
      "rahmen-a": 0,
      "rahmen-b": 0,
    });
    expect(proportionalAwards([], 1_000)).toEqual({});
  });
});

describe("awardSplitDeniedReason", () => {
  it("lässt durch, was hineinpasst — auch punktgenau", () => {
    expect(awardSplitDeniedReason(100_000, 100_000)).toBeNull();
    expect(awardSplitDeniedReason(0, 100_000)).toBeNull();
  });

  it("nennt die Überschreitung mit Betrag", () => {
    expect(awardSplitDeniedReason(120_000, 100_000)).toContain("20000");
  });

  it("weist negative Summen ab", () => {
    expect(awardSplitDeniedReason(-1, 100_000)).not.toBeNull();
  });
});
