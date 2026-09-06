import { describe, it, expect } from "vitest";
import { benefitPerformance } from "@/modules/core/goals/domain/epic-contribution";

describe("benefitPerformance — uebertrifft das Epic seinen Plan?", () => {
  it("meldet ueber und unter Plan mit der Abweichung", () => {
    const over = benefitPerformance({ planned: 100, realized: 130 })!;
    expect(over.state).toBe("over");
    expect(over.delta).toBeCloseTo(0.3, 10);
    const under = benefitPerformance({ planned: 100, realized: 70 })!;
    expect(under.state).toBe("under");
    expect(under.delta).toBeCloseTo(-0.3, 10);
  });

  it("nennt fuenf Prozent Rueckstand einen Rueckstand", () => {
    // Der gemeldete Fall: 718 von 756. Ein Totband von fuenf Prozent las das
    // als „wie geplant" — und lag damit genau dort, wo der Datensatz seine
    // Werte hat (Ist = 95 % des Plans). Ob eine Zeile kippte, entschied die
    // Rundung auf Tausender.
    const r = benefitPerformance({ planned: 756_000, realized: 718_000 })!;
    expect(r.state).toBe("under");
    expect(r.delta).toBeCloseTo(-0.05026, 5);
  });

  it("meldet auch kleinste Abweichungen mit ihrem Vorzeichen", () => {
    expect(benefitPerformance({ planned: 100, realized: 100.1 })!.state).toBe("over");
    expect(benefitPerformance({ planned: 100, realized: 99.9 })!.state).toBe("under");
  });

  it("sagt „wie geplant“ nur bei exakter Gleichheit", () => {
    const on = benefitPerformance({ planned: 756_000, realized: 756_000 })!;
    expect(on.state).toBe("on");
    expect(on.delta).toBe(0);
  });

  it("gibt ohne Plan nichts zurueck, statt durch null zu teilen", () => {
    expect(benefitPerformance({ planned: 0, realized: 500 })).toBeNull();
    expect(benefitPerformance({ planned: -10, realized: 5 })).toBeNull();
  });

  it("behandelt ein realisiertes Null als vollstaendigen Ausfall", () => {
    // Nicht dasselbe wie „kein Plan": hier ist geplant und nichts angekommen.
    expect(benefitPerformance({ planned: 100, realized: 0 })).toEqual({
      state: "under",
      delta: -1,
    });
  });
});
