import { describe, it, expect } from "vitest";
import {
  mayHoldAllocation,
  requiresCurrentAllocation,
  allocationRuleViolations,
  formatAllocationViolations,
  FIRST_FUNDABLE_STEP,
  type AllocationFacts,
} from "@/modules/budgeting/domain/allocation-eligibility";
import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";

const epic = (id: string, step: GateStep, amountInCycle: number): AllocationFacts => ({
  id,
  title: `Epic ${id}`,
  step,
  amountInCycle,
});

describe("mayHoldAllocation — Budget erst ab L3.1", () => {
  it("lässt die vier frühen Schritte nicht zu", () => {
    // Funnel, Hypothese, Analyse-Einplanung, Business Case: vorher gibt es
    // keine freigegebene Investitionsentscheidung.
    for (const step of ["L0", "L1", "L2"] as const) {
      expect(mayHoldAllocation(step)).toBe(false);
    }
  });

  it("lässt alles ab L3.1 zu", () => {
    for (const step of ["L3.1", "L3.2", "L4", "L4.2", "L5"] as const) {
      expect(mayHoldAllocation(step)).toBe(true);
    }
  });

  it("teilt die Leiter genau einmal", () => {
    // Kein Loch: unterhalb der Grenze nie, oberhalb immer.
    const flags = GATE_STEPS.map(mayHoldAllocation);
    expect(flags.indexOf(true)).toBe(GATE_STEPS.indexOf(FIRST_FUNDABLE_STEP));
    expect(flags.lastIndexOf(false)).toBeLessThan(flags.indexOf(true));
  });
});

describe("requiresCurrentAllocation — nur die Umsetzung verlangt Geld", () => {
  it("verlangt es für L4.1", () => {
    expect(requiresCurrentAllocation("L4")).toBe(true);
  });

  it("verlangt es für keinen anderen Schritt", () => {
    // L4.2 und L5 dürfen Geld tragen (im Zeitraum fertig geworden), müssen aber
    // nicht — sie können lange davor fertig gewesen sein.
    for (const step of GATE_STEPS.filter((s) => s !== "L4")) {
      expect(requiresCurrentAllocation(step)).toBe(false);
    }
  });
});

describe("allocationRuleViolations", () => {
  it("findet Geld in zu frühen Reifegraden", () => {
    const v = allocationRuleViolations(
      [epic("a", "L0", 80_000), epic("b", "L2", 50_000), epic("c", "L3.1", 90_000)],
      "2026-H2",
    );
    expect(v.map((x) => x.id)).toEqual(["a", "b"]);
    expect(v[0]!.kind).toBe("funded_too_early");
    expect(v[0]!.reason).toContain("L3.1");
  });

  it("findet laufende Epics ohne Budget", () => {
    const v = allocationRuleViolations([epic("a", "L4", 0), epic("b", "L4", 70_000)], "2026-H2");
    expect(v.map((x) => x.id)).toEqual(["a"]);
    expect(v[0]!.kind).toBe("running_without_budget");
    expect(v[0]!.reason).toContain("Vorrang");
  });

  it("lässt die erlaubten Zustände in Ruhe", () => {
    // Alle fünf, die im laufenden Zeitraum vorkommen dürfen.
    const ok: AllocationFacts[] = [
      epic("a", "L3.1", 60_000),
      epic("b", "L3.2", 60_000),
      epic("c", "L4", 60_000),
      epic("d", "L4.2", 60_000),
      epic("e", "L5", 60_000),
      // …und die frühen ohne Geld.
      epic("f", "L0", 0),
      epic("g", "L1", 0),
      epic("h", "L2", 0),
      // …und ein längst fertiges ohne Geld im laufenden Zyklus.
      epic("i", "L5", 0),
    ];
    expect(allocationRuleViolations(ok, "2026-H2")).toEqual([]);
  });

  it("nennt Namen, damit ein scheiternder Seed brauchbar ist", () => {
    const text = formatAllocationViolations(
      allocationRuleViolations([epic("a", "L1", 50_000)], "2026-H2"),
    );
    expect(text).toContain("Epic a");
    expect(text).toContain("2026-H2");
  });
});
