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

function keys(f: EpicGateFacts, to: GateStep, which: "unsatisfied" | "blocking-unsatisfied") {
  return gateReadiness(f, to)
    .criteria.filter((c) => !c.satisfied && (which === "unsatisfied" || c.blocking))
    .map((c) => c.key);
}

describe("nextGate / previousGate", () => {
  it("läuft die kanonische Schritt-Reihenfolge ab und endet an den Rändern", () => {
    // L3.2 („Budget alloziert") und L4.2 („Umsetzung fertig") liegen als eigene
    // Schritte in ihrem Haupt-Gate.
    expect(
      ["L0", "L1", "L2", "L3.1", "L3.2", "L4", "L4.2"].map((g) => nextGate(g as GateStep)),
    ).toEqual(["L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"]);
    expect(nextGate("L5")).toBeNull();
    expect(previousGate("L0")).toBeNull();
    expect(previousGate("L3.1")).toBe("L2");
    expect(previousGate("L4")).toBe("L3.2");
    expect(previousGate("L5")).toBe("L4.2");
  });
});

describe("gateReadiness — L1 (Selektion ins Detailing)", () => {
  it("verlangt ausgearbeiteten Inhalt, nicht den Freigabe-Stempel", () => {
    // Die Abnahme dieses Schritts *ist* die Hypothesen-Freigabe — sie hier zu
    // verlangen wäre zirkulär.
    expect(keys(facts("L0"), "L1", "blocking-unsatisfied")).toEqual(["hypothesis_drafted"]);
    expect(keys(facts("L0", { hasHypothesisContent: true }), "L1", "blocking-unsatisfied")).toEqual(
      [],
    );
  });

  it("die Practice spielt hier keine Rolle mehr", () => {
    for (const multi of [true, false]) {
      const f = facts("L0", { multiPartyApproval: multi, hasHypothesisContent: true });
      expect(gateReadiness(f, "L1").ready, String(multi)).toBe(true);
      expect(gateReadiness(f, "L1").criteria[0]?.label).toBe("Benefit-Hypothese ist ausgearbeitet");
    }
  });

  it("der fehlende Epic Owner ist beratend — er blockiert nicht", () => {
    const f = facts("L0", { hasHypothesisContent: true, ownerId: null });
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
    expect(keys(facts("L1"), "L2", "blocking-unsatisfied")).toEqual(["hypothesis_approved"]);
  });
});

describe("gateReadiness — L3 (Investitionsentscheidung)", () => {
  it("der Eintritt in L3 verlangt den ausgearbeiteten Business Case, nicht seine Freigabe", () => {
    // Die Abnahme dieses Schritts *ist* die Freigabe — sie zur Vorbedingung zu
    // machen wäre zirkulär.
    expect(keys(facts("L2"), "L3.1", "blocking-unsatisfied")).toEqual(["business_case_drafted"]);
    expect(gateReadiness(facts("L2", { hasBusinessCaseContent: true }), "L3.1").ready).toBe(true);
    // Das Geld ist hier ausdrücklich noch kein Thema; offen bleibt allenfalls
    // die beratende Owner-Nennung.
    expect(keys(facts("L2", { hasBusinessCaseContent: true }), "L3.1", "unsatisfied")).toEqual([
      "owner_nominated",
    ]);
  });

  it("L3.2 verlangt das allozierte Budget", () => {
    expect(keys(facts("L3"), "L3.2", "blocking-unsatisfied")).toEqual(["budget_allocated"]);
    expect(gateReadiness(facts("L3", { budgetAllocationSum: 1 }), "L3.2").ready).toBe(true);
  });

  it("ein Budget von exakt 0 zählt nicht als alloziert", () => {
    const f = facts("L3", { budgetAllocationSum: 0 });
    expect(gateReadiness(f, "L3.2").ready).toBe(false);
  });
});

describe("gateReadiness — L4 (Start der Umsetzung)", () => {
  it("ist beratend: der Antrag selbst ist der bewusste Start", () => {
    const f = facts("L3", { budgetAllocationSum: 1 });
    expect(gateReadiness(f, "L4").ready).toBe(true);
    expect(keys(f, "L4", "unsatisfied")).toEqual(["feature_started"]);
    expect(keys(f, "L4", "blocking-unsatisfied")).toEqual([]);
  });
});

describe("gateReadiness — L4.2 (Umsetzung fertig)", () => {
  it("ist beratend: offene Features halten den Antrag nicht auf", () => {
    const f = facts("L4", { childFeatureStats: { total: 3, started: 3, completed: 2 } });
    expect(gateReadiness(f, "L4.2").ready).toBe(true);
    expect(keys(f, "L4.2", "unsatisfied")).toEqual(["features_completed"]);
    expect(keys(f, "L4.2", "blocking-unsatisfied")).toEqual([]);
  });

  it("meldet das Kriterium als erfüllt, sobald alle Child-Features fertig sind", () => {
    const f = facts("L4", { childFeatureStats: { total: 3, started: 3, completed: 3 } });
    expect(keys(f, "L4.2", "unsatisfied")).toEqual([]);
  });

  it("ein Epic ganz ohne Features erfüllt das Kriterium nicht, blockiert aber nicht", () => {
    // „0 von 0" bleibt unerfüllt (allChildrenCompleted) — nur eben ohne Tor.
    const f = facts("L4", { childFeatureStats: { total: 0, started: 0, completed: 0 } });
    expect(gateReadiness(f, "L4.2").ready).toBe(true);
    expect(keys(f, "L4.2", "unsatisfied")).toEqual(["features_completed"]);
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
    expect(readinessBlockReason(gateReadiness(facts("L1"), "L2"))).toBe(
      "Reifegrad L2 verlangt: Benefit-Hypothese ist freigegeben.",
    );
    expect(readinessBlockReason(gateReadiness(facts("L3"), "L3.2"))).toBe(
      "Reifegrad L3.2 verlangt: Budget ist alloziert (Σ > 0).",
    );
  });

  it("ist null, wenn nur beratende Kriterien offen sind", () => {
    expect(readinessBlockReason(gateReadiness(facts("L3"), "L4"))).toBeNull();
  });

  it("ist null, wenn alles erfüllt ist", () => {
    const f = facts("L2", { hasBusinessCaseContent: true, budgetAllocationSum: 10 });
    expect(readinessBlockReason(gateReadiness(f, "L3.1"))).toBeNull();
  });
});
