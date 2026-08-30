import { describe, it, expect } from "vitest";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { GateStep } from "@/modules/work/domain/stage-gate";
import {
  gateReadiness,
  readinessBlockReason,
  nextGate,
  previousGate,
  type EpicGateFacts,
} from "@/modules/work/domain/gate-readiness";

/** Ein Epic auf `stageGate`, bei dem sonst nichts erfüllt ist. */
function facts(stageGate: StageGate, over: Partial<EpicGateFacts> = {}): EpicGateFacts {
  return {
    stageGate,
    ownerId: null,
    hypothesisApprovedAt: null,
    hasHypothesisContent: false,
    hasBusinessCaseContent: false,
    businessCaseApprovedAt: null,
    budgetAllocationSum: 0,
    childFeatureStats: { total: 0, started: 0, completed: 0 },
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: null,
    implementationStartedAt: null,
    implementationCompletedAt: null,
    approvedAt: null,
    impactRecognizedAt: null,
    multiPartyApproval: true,
    ...over,
  };
}

const AT = new Date("2026-03-01T00:00:00.000Z");

function keys(f: EpicGateFacts, to: StageGate, which: "unsatisfied" | "blocking-unsatisfied") {
  return gateReadiness(f, to)
    .criteria.filter((c) => !c.satisfied && (which === "unsatisfied" || c.blocking))
    .map((c) => c.key);
}

describe("nextGate / previousGate", () => {
  it("läuft die kanonische Schritt-Reihenfolge ab und endet an den Rändern", () => {
    // L4.2 („Umsetzung fertig") liegt als eigener Schritt zwischen L4 und L5.
    expect(["L0", "L1", "L2", "L3", "L4", "L4.2"].map((g) => nextGate(g as GateStep))).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
      "L4.2",
      "L5",
    ]);
    expect(nextGate("L5")).toBeNull();
    expect(previousGate("L0")).toBeNull();
    expect(previousGate("L3")).toBe("L2");
    expect(previousGate("L5")).toBe("L4.2");
  });
});

describe("gateReadiness — L1 (Selektion ins Detailing)", () => {
  it("Mehrparteien: verlangt den Freigabe-Stempel, nicht bloss Inhalt", () => {
    expect(keys(facts("L0", { hasHypothesisContent: true }), "L1", "blocking-unsatisfied")).toEqual(
      ["hypothesis_ready"],
    );
    expect(keys(facts("L0", { hypothesisApprovedAt: AT }), "L1", "blocking-unsatisfied")).toEqual(
      [],
    );
  });

  it("Einparteien: ausgearbeiteter Inhalt genügt", () => {
    const f = facts("L0", { multiPartyApproval: false, hasHypothesisContent: true });
    expect(gateReadiness(f, "L1").ready).toBe(true);
  });

  it("das Label folgt der Practice-Gabelung", () => {
    const label = (multi: boolean) =>
      gateReadiness(facts("L0", { multiPartyApproval: multi }), "L1").criteria[0]?.label;
    expect(label(true)).toBe("Benefit-Hypothese ist freigegeben");
    expect(label(false)).toBe("Benefit-Hypothese ist ausgearbeitet");
  });

  it("der fehlende Epic Owner ist beratend — er blockiert nicht", () => {
    const f = facts("L0", { hypothesisApprovedAt: AT, ownerId: null });
    const r = gateReadiness(f, "L1");
    expect(r.ready).toBe(true);
    expect(keys(f, "L1", "unsatisfied")).toEqual(["owner_nominated"]);
  });
});

describe("gateReadiness — L2 (Eintritt in die Analyse)", () => {
  it("spiegelt L1: die Hypothese ist die Vorleistung, nicht der Business Case", () => {
    const f = facts("L1", { hypothesisApprovedAt: AT });
    expect(gateReadiness(f, "L2").ready).toBe(true);
    expect(keys(f, "L2", "unsatisfied")).toEqual(["owner_nominated", "business_case_started"]);
  });

  it("ohne freigegebene Hypothese blockiert L2", () => {
    expect(keys(facts("L1"), "L2", "blocking-unsatisfied")).toEqual(["hypothesis_ready"]);
  });
});

describe("gateReadiness — L3 (Investitionsentscheidung)", () => {
  it("verlangt freigegebenen Business Case UND Budget Σ > 0", () => {
    expect(keys(facts("L2"), "L3", "blocking-unsatisfied")).toEqual([
      "business_case_approved",
      "budget_allocated",
    ]);
    expect(keys(facts("L2", { businessCaseApprovedAt: AT }), "L3", "blocking-unsatisfied")).toEqual(
      ["budget_allocated"],
    );
    expect(
      keys(facts("L2", { budgetAllocationSum: 250_000 }), "L3", "blocking-unsatisfied"),
    ).toEqual(["business_case_approved"]);
    expect(
      gateReadiness(facts("L2", { businessCaseApprovedAt: AT, budgetAllocationSum: 1 }), "L3")
        .ready,
    ).toBe(true);
  });

  it("ein Budget von exakt 0 zählt nicht als alloziert", () => {
    const f = facts("L2", { businessCaseApprovedAt: AT, budgetAllocationSum: 0 });
    expect(gateReadiness(f, "L3").ready).toBe(false);
  });
});

describe("gateReadiness — L4 (Start der Umsetzung)", () => {
  it("ist beratend: der Antrag selbst ist der bewusste Start", () => {
    const f = facts("L3");
    expect(gateReadiness(f, "L4").ready).toBe(true);
    expect(keys(f, "L4", "unsatisfied")).toEqual(["feature_started"]);
    expect(keys(f, "L4", "blocking-unsatisfied")).toEqual([]);
  });
});

describe("gateReadiness — L4.2 (Umsetzung fertig)", () => {
  it("verlangt, dass alle Child-Features fertig sind", () => {
    expect(
      gateReadiness(
        facts("L4", { childFeatureStats: { total: 3, started: 3, completed: 2 } }),
        "L4.2",
      ).ready,
    ).toBe(false);
    expect(
      gateReadiness(
        facts("L4", { childFeatureStats: { total: 3, started: 3, completed: 3 } }),
        "L4.2",
      ).ready,
    ).toBe(true);
  });

  it("ein Epic ganz ohne Features ist nicht fertig (0 von 0 zählt nicht)", () => {
    expect(
      gateReadiness(
        facts("L4", { childFeatureStats: { total: 0, started: 0, completed: 0 } }),
        "L4.2",
      ).ready,
    ).toBe(false);
  });
});

describe("gateReadiness — L5 (Impact)", () => {
  it("verlangt die abgenommene L4.2-Bestätigung, nicht mehr die Feature-Zähler", () => {
    // Alle Features fertig, aber nicht bestätigt ⇒ noch kein Impact-Antrag.
    expect(
      gateReadiness(
        facts("L4", { childFeatureStats: { total: 3, started: 3, completed: 3 } }),
        "L5",
      ).ready,
    ).toBe(false);
    // Bestätigt ⇒ bereit, unabhängig von den Zählern (L4.2 ≠ L5, Zeit darf vergehen).
    expect(
      gateReadiness(
        facts("L4", {
          childFeatureStats: { total: 3, started: 3, completed: 3 },
          implementationCompletedAt: new Date("2026-05-01"),
        }),
        "L5",
      ).ready,
    ).toBe(true);
  });
});

describe("readinessBlockReason", () => {
  it("nennt nur die blockierenden, unerfüllten Kriterien", () => {
    expect(readinessBlockReason(gateReadiness(facts("L2"), "L3"))).toBe(
      "Reifegrad L3 verlangt: Business Case ist freigegeben; Budget ist alloziert (Σ > 0).",
    );
  });

  it("ist null, wenn nur beratende Kriterien offen sind", () => {
    expect(readinessBlockReason(gateReadiness(facts("L3"), "L4"))).toBeNull();
  });

  it("ist null, wenn alles erfüllt ist", () => {
    const f = facts("L2", { businessCaseApprovedAt: AT, budgetAllocationSum: 10 });
    expect(readinessBlockReason(gateReadiness(f, "L3"))).toBeNull();
  });
});
