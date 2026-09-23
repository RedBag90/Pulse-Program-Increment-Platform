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
    solutionHorizon: null,
    investmentHorizon: null,
    multiPartyApproval: true,
    budgetingEnabled: true,
    kpiCount: 0,
    dependencyCount: 0,
    drumbeatEnabled: true,
    ...over,
  };
}

const AT = new Date("2026-03-01T00:00:00.000Z");

function keys(
  f: EpicGateFacts,
  to: GateStep,
  which: "all" | "blocking" | "unsatisfied" | "blocking-unsatisfied",
) {
  const offen = which === "unsatisfied" || which === "blocking-unsatisfied";
  const blockierend = which === "blocking" || which === "blocking-unsatisfied";
  return gateReadiness(f, to)
    .criteria.filter((c) => (!offen || !c.satisfied) && (!blockierend || c.blocking))
    .map((c) => c.key);
}

describe("nextGate / previousGate", () => {
  it("läuft die kanonische Schritt-Reihenfolge ab und endet an den Rändern", () => {
    // `analysis` („zur Analyse ausgewählt") und L4.2 („Umsetzung fertig")
    // liegen als eigene Schritte in einem fremden Haupt-Gate.
    expect(
      ["L0", "L1", "analysis", "L2", "L3", "L4", "L4.2"].map((g) => nextGate(g as GateStep)),
    ).toEqual(["L1", "analysis", "L2", "L3", "L4", "L4.2", "L5"]);
    expect(nextGate("L5")).toBeNull();
    expect(previousGate("L0")).toBeNull();
    expect(previousGate("L2")).toBe("analysis");
    expect(previousGate("L4")).toBe("L3");
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

describe("gateReadiness — die Analyse-Entscheidung", () => {
  it("spiegelt L1: die Hypothese ist die Vorleistung, nicht der Business Case", () => {
    const f = facts("L1", { hypothesisApprovedAt: AT });
    expect(gateReadiness(f, "analysis").ready).toBe(true);
    expect(keys(f, "analysis", "unsatisfied")).toEqual(["owner_nominated"]);
  });

  it("verlangt den Business Case in keiner Form — auch nicht beratend", () => {
    // Dieser Schritt ist die Entscheidung, mit der Analyse anzufangen. Der
    // Business Case entsteht danach; ihn vorher zu nennen, drehte die
    // Reihenfolge um. Geprüft über die **volle** Liste, nicht nur über die
    // unerfüllten: sonst verschwände der Punkt aus dem Test, sobald ein
    // Fixture-Epic zufällig Business-Case-Inhalt trägt.
    expect(keys(facts("L1"), "analysis", "all")).toEqual([
      "hypothesis_approved",
      "owner_nominated",
    ]);
  });

  it("verschiebt die Frage nur — L2 verlangt ihn weiterhin, und zwar blockierend", () => {
    expect(keys(facts("L1"), "L2", "blocking")).toEqual(["business_case_drafted"]);
  });

  it("ohne freigegebene Hypothese blockiert der Schritt", () => {
    expect(keys(facts("L1"), "analysis", "blocking-unsatisfied")).toEqual(["hypothesis_approved"]);
  });
});

describe("gateReadiness — L2 (Business-Case-Freigabe)", () => {
  it("verlangt den ausgearbeiteten Business Case, nicht seine Freigabe", () => {
    // Die Abnahme dieses Schritts *ist* die Freigabe — sie zur Vorbedingung zu
    // machen wäre zirkulär.
    expect(keys(facts("L2"), "L2", "blocking-unsatisfied")).toEqual(["business_case_drafted"]);
    expect(gateReadiness(facts("L2", { hasBusinessCaseContent: true }), "L2").ready).toBe(true);
    // Das Geld ist hier ausdrücklich noch kein Thema. Offen bleiben allein die
    // beratenden Punkte — sie halten den Schritt nicht auf, sagen aber, was auf
    // dieser Stufe sonst noch erarbeitet wird.
    expect(keys(facts("L2", { hasBusinessCaseContent: true }), "L2", "unsatisfied")).toEqual([
      "deliverables_drafted",
      "dependencies_mapped",
      "kpis_defined",
      "owner_nominated",
    ]);
  });

  it("führt die vier Reiter der Stufe in ihrer Reihenfolge — und blockiert nur mit einem", () => {
    // Business Case, Deliverables, Dependencies, KPI: die vier Flächen, die auf
    // dieser Stufe erarbeitet werden, stehen in der Reihenfolge der Reiter auf
    // der Checkliste. Blockierend ist allein der Business Case, denn nur ihn
    // gibt dieser Schritt frei.
    expect(keys(facts("L2"), "L2", "all")).toEqual([
      "business_case_drafted",
      "deliverables_drafted",
      "dependencies_mapped",
      "kpis_defined",
      "owner_nominated",
    ]);
    expect(keys(facts("L2"), "L2", "blocking")).toEqual(["business_case_drafted"]);
  });

  it("zeigt die Abhängigkeiten gar nicht, wo es das Drumbeat-Modul nicht gibt", () => {
    // Ohne Drumbeat gibt es den Reiter nicht, in dem man das Kriterium erfüllen
    // würde. Ein Kreuz, das nie grün wird, wäre eine Sackgasse; ein Häkchen
    // wäre eine Falschaussage. Also: weg damit — dieselbe Entscheidung wie beim
    // Budget-Kriterium.
    expect(keys(facts("L2", { drumbeatEnabled: false }), "L2", "all")).not.toContain(
      "dependencies_mapped",
    );
    expect(keys(facts("L2", { drumbeatEnabled: true }), "L2", "all")).toContain(
      "dependencies_mapped",
    );
  });

  it("hakt die Reiter ab, sobald dort Inhalt steht", () => {
    const gepflegt = facts("L2", {
      childFeatureStats: { total: 3, started: 0, completed: 0 },
      dependencyCount: 2,
      kpiCount: 1,
    });
    expect(keys(gepflegt, "L2", "unsatisfied")).toEqual([
      "business_case_drafted",
      "owner_nominated",
    ]);
  });

  it("L3.2 verlangt das allozierte Budget", () => {
    expect(keys(facts("L3"), "L3", "blocking-unsatisfied")).toEqual(["budget_allocated"]);
    expect(gateReadiness(facts("L3", { budgetAllocationSum: 1 }), "L3").ready).toBe(true);
  });

  it("ein Budget von exakt 0 zählt nicht als alloziert", () => {
    const f = facts("L3", { budgetAllocationSum: 0 });
    expect(gateReadiness(f, "L3").ready).toBe(false);
  });

  /**
   * **Ohne Budget-Modul ist die Reifegrad-Leiter sonst zu Ende.**
   *
   * Es gibt dann keine Zuteilung, die das Kriterium erfüllen könnte, und
   * `planGateRequest` lässt genau einen Schritt zu — jedes Epic blieb also für
   * immer auf L3.1. Das Kriterium ist die Vorbedingung der
   * Investitionsentscheidung, nicht die Entscheidung: wo es keine Zahl gibt,
   * bleibt die Unterschrift von VMO und Finance, und die ist es, die ADR-0018
   * verlangt.
   */
  it("ohne Budget-Modul entfällt das Kriterium — der Schritt ruht auf der Abnahme", () => {
    const f = facts("L3", { budgetingEnabled: false, budgetAllocationSum: 0 });
    expect(gateReadiness(f, "L3").ready).toBe(true);
  });

  it("zeigt das Kriterium dann gar nicht — ein Häkchen daran wäre gelogen", () => {
    const f = facts("L3", { budgetingEnabled: false });
    expect(gateReadiness(f, "L3").criteria).toEqual([]);
    expect(readinessBlockReason(gateReadiness(f, "L3"))).toBeNull();
  });

  it("lässt die anderen Schritte unberührt — nur L3.2 kennt das Modul", () => {
    const ohne = facts("L2", { budgetingEnabled: false });
    const mit = facts("L2", { budgetingEnabled: true });
    expect(gateReadiness(ohne, "L2").criteria.map((c) => c.key)).toEqual(
      gateReadiness(mit, "L2").criteria.map((c) => c.key),
    );
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
    expect(readinessBlockReason(gateReadiness(facts("L1"), "analysis"))).toBe(
      "Reifegrad analysis verlangt: Benefit-Hypothese ist freigegeben.",
    );
    expect(readinessBlockReason(gateReadiness(facts("L2"), "L3"))).toBe(
      "Reifegrad L3 verlangt: Budget ist alloziert (Σ > 0).",
    );
  });

  it("ist null, wenn nur beratende Kriterien offen sind", () => {
    expect(readinessBlockReason(gateReadiness(facts("L3"), "L4"))).toBeNull();
  });

  it("ist null, wenn alles erfüllt ist", () => {
    const f = facts("L2", { hasBusinessCaseContent: true, budgetAllocationSum: 10 });
    expect(readinessBlockReason(gateReadiness(f, "L2"))).toBeNull();
  });
});
