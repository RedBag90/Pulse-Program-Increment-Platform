import { describe, it, expect } from "vitest";
import {
  rtbIntervalOrDefault,
  rtbAnnualAmount,
  rtbCycleAmount,
  sumRtbAnnual,
  sumRtbCycle,
  RTB_INTERVALS,
  type RtbAmountLike,
} from "@/modules/budgeting/domain/rtb-interval";

const item = (over: Partial<RtbAmountLike> = {}): RtbAmountLike => ({
  plannedAmount: 120_000,
  interval: "half_yearly",
  active: true,
  ...over,
});

describe("rtbIntervalOrDefault", () => {
  it("nimmt jeden gültigen Wert", () => {
    for (const i of RTB_INTERVALS) expect(rtbIntervalOrDefault(i)).toBe(i);
  });

  it("fällt auf `half_yearly` zurück — die Bedeutung der Bestandszeilen", () => {
    expect(rtbIntervalOrDefault(null)).toBe("half_yearly");
    expect(rtbIntervalOrDefault(undefined)).toBe("half_yearly");
    expect(rtbIntervalOrDefault("quarterly")).toBe("half_yearly");
  });
});

describe("rtbAnnualAmount", () => {
  it("rechnet jede Periode aufs Jahr hoch", () => {
    expect(rtbAnnualAmount(20_000, "monthly")).toBe(240_000);
    expect(rtbAnnualAmount(120_000, "half_yearly")).toBe(240_000);
    expect(rtbAnnualAmount(240_000, "yearly")).toBe(240_000);
  });

  it("unbrauchbare Beträge ergeben 0 statt NaN", () => {
    expect(rtbAnnualAmount(Number.NaN, "yearly")).toBe(0);
  });
});

describe("rtbCycleAmount — der Ask einer Halbjahres-Kachel", () => {
  it("die Bestands-Invariante: `half_yearly` fragt exakt den gepflegten Betrag an", () => {
    // Genau daran hängt, dass sich beim Umbau kein einziger existierender Ask
    // verschiebt — jede Bestandszeile steht auf `half_yearly`.
    expect(rtbCycleAmount(120_000, "half_yearly")).toBe(120_000);
    expect(rtbCycleAmount(15_000, null)).toBe(15_000);
  });

  it("jährlich wird halbiert, monatlich versechsfacht", () => {
    expect(rtbCycleAmount(60_000, "yearly")).toBe(30_000);
    expect(rtbCycleAmount(20_000, "monthly")).toBe(120_000);
  });

  it("zwei Kacheln ergeben zusammen das Jahr", () => {
    for (const i of RTB_INTERVALS) {
      expect(rtbCycleAmount(7_500, i) * 2).toBeCloseTo(rtbAnnualAmount(7_500, i));
    }
  });
});

describe("Summen", () => {
  const items = [
    item({ plannedAmount: 120_000, interval: "half_yearly" }), // 240.000 p. a.
    item({ plannedAmount: 60_000, interval: "yearly" }), //       60.000 p. a.
    item({ plannedAmount: 20_000, interval: "monthly" }), //     240.000 p. a.
  ];

  it("addieren über gemischte Perioden", () => {
    expect(sumRtbAnnual(items)).toBe(540_000);
    expect(sumRtbCycle(items)).toBe(270_000);
  });

  it("zählen nur aktive Positionen", () => {
    const withInactive = [
      ...items,
      item({ plannedAmount: 999_000, interval: "yearly", active: false }),
    ];
    expect(sumRtbAnnual(withInactive)).toBe(540_000);
  });

  it("eine leere Liste ergibt 0", () => {
    expect(sumRtbAnnual([])).toBe(0);
    expect(sumRtbCycle([])).toBe(0);
  });
});
