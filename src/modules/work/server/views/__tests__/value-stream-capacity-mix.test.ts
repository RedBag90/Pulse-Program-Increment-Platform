import { describe, it, expect } from "vitest";

import {
  buildValueStreamCapacityMix,
  type DeliveredEpic,
} from "@/modules/work/server/views/value-stream-capacity-mix";

const TARGETS = { business: 75, enabler: 25 };

const e = (over: Partial<DeliveredEpic> & { amount: number }): DeliveredEpic => ({
  id: over.id ?? `e${over.amount}`,
  title: "Epic",
  epicType: over.epicType ?? "epic",
  cycleKey: over.cycleKey ?? "2026-H1",
  ...over,
});

describe("buildValueStreamCapacityMix", () => {
  it("misst den Mix am zugeteilten Budget, nicht an der Anzahl", () => {
    const m = buildValueStreamCapacityMix(
      [
        e({ id: "a", amount: 2_392_000, epicType: "epic" }),
        e({ id: "b", amount: 208_000, epicType: "enabler" }),
      ],
      TARGETS,
    );
    expect(m.mix.rows.business.amount).toBe(2_392_000);
    expect(Math.round(m.mix.rows.business.amountShare * 100)).toBe(92);
    expect(Math.round(m.mix.rows.enabler.amountShare * 100)).toBe(8);
  });

  it("trägt die Ziele mit, gegen die gemessen wird", () => {
    const m = buildValueStreamCapacityMix([e({ amount: 100 })], TARGETS);
    expect(m.targets).toEqual(TARGETS);
    expect(m.mix.rows.business.target).toBeCloseTo(0.75, 6);
  });

  // Epics ohne Typ verzerren den Mix — sie fallen aus den Anteilen, aber nicht
  // aus dem Blick.
  it("hält unklassifizierte Epics aus den Anteilen heraus und weist sie aus", () => {
    const m = buildValueStreamCapacityMix(
      [
        e({ id: "a", amount: 900, epicType: "epic" }),
        e({ id: "b", amount: 100, epicType: "enabler" }),
        e({ id: "c", amount: 500, epicType: null }),
      ],
      TARGETS,
    );
    expect(m.unclassified).toEqual({ count: 1, amount: 500 });
    expect(m.mix.rows.business.amount + m.mix.rows.enabler.amount).toBe(1_000);
    expect(m.totalEpics).toBe(3);
  });

  // Der Trend ist die eigentliche Information — ein Gesamtwert verdeckt ihn.
  it("zeigt die Entwicklung je Halbjahr, aufsteigend", () => {
    const m = buildValueStreamCapacityMix(
      [
        e({ id: "a", amount: 1_232_000, epicType: "epic", cycleKey: "2025-H2" }),
        e({ id: "b", amount: 168_000, epicType: "enabler", cycleKey: "2025-H2" }),
        e({ id: "c", amount: 1_160_000, epicType: "epic", cycleKey: "2026-H1" }),
        e({ id: "d", amount: 40_000, epicType: "enabler", cycleKey: "2026-H1" }),
      ],
      TARGETS,
    );
    expect(m.byCycle.map((c) => c.cycleKey)).toEqual(["2025-H2", "2026-H1"]);
    expect(m.byCycle[0]!.enablerShare).toBe(12);
    expect(m.byCycle[1]!.enablerShare).toBe(3);
  });

  it("leere Eingabe ergibt einen leeren Mix, keine Ausnahme", () => {
    const m = buildValueStreamCapacityMix([], TARGETS);
    expect(m.totalEpics).toBe(0);
    expect(m.byCycle).toEqual([]);
    expect(m.mix.rows.business.amount).toBe(0);
  });
});
