import { describe, it, expect } from "vitest";
import { GATE_CRITERIA_DOC, SUB_STAGE_RULES } from "@/modules/work/domain/epic-lifecycle-doc";
import { SUB_STAGES } from "@/modules/work/domain/stage-gate";
import {
  GATE_CRITERIA,
  gateReadiness,
  type EpicGateFacts,
} from "@/modules/work/domain/gate-readiness";

/**
 * Der Doku-Katalog war früher eine Parallelliste, die veralten konnte — und es
 * auch tat. Jetzt wird er aus `GATE_CRITERIA` abgeleitet; diese Tests halten
 * fest, dass die Ableitung vollständig und mit der Auswertung deckungsgleich
 * bleibt.
 */

describe("GATE_CRITERIA_DOC", () => {
  it("deckt genau die sieben Vorwärts-Schritte ab (inkl. L3→L3.2 und L4→L4.2)", () => {
    expect(GATE_CRITERIA_DOC.map((g) => `${g.stageFrom}->${g.stageTo}`)).toEqual([
      "L0->L1",
      "L1->L2",
      "L2->L3.1",
      "L3.1->L3.2",
      "L3.2->L4",
      "L4->L4.2",
      "L4.2->L5",
    ]);
  });

  it("hat für L5 keinen Eintrag — dort endet der Funnel", () => {
    expect(GATE_CRITERIA_DOC.some((g) => g.stageFrom === "L5")).toBe(false);
  });

  it("zeigt je Wechsel genauso viele Kriterien wie die Auswertung", () => {
    // Der Punkt der Ableitung: Doku und Regel können nicht auseinanderlaufen.
    for (const g of GATE_CRITERIA_DOC) {
      expect(g.criteria).toHaveLength((GATE_CRITERIA[g.stageTo] ?? []).length);
    }
  });

  it("stimmt in Beschriftung und Blocking-Flag mit der Auswertung überein", () => {
    const facts: EpicGateFacts = {
      stageGate: "L2",
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
    };
    const doc = GATE_CRITERIA_DOC.find((g) => g.stageTo === "L3.1");
    const evaluated = gateReadiness(facts, "L3.1");
    expect(doc?.criteria.map((c) => [c.label, c.blocking])).toEqual(
      evaluated.criteria.map((c) => [c.label, c.blocking]),
    );
  });

  it("markiert bei L3.1 den Business Case als blockierend, bei L4 keines", () => {
    const l3 = GATE_CRITERIA_DOC.find((g) => g.stageTo === "L3.1");
    const l4 = GATE_CRITERIA_DOC.find((g) => g.stageTo === "L4");
    // Die Owner-Nennung ist auch hier nur beratend — blockierend ist der Inhalt.
    expect(l3?.criteria.filter((c) => c.blocking).map((c) => c.label)).toEqual([
      "Business Case ist ausgearbeitet",
    ]);
    expect(l4?.criteria.some((c) => c.blocking)).toBe(false);
  });
});

describe("SUB_STAGE_RULES", () => {
  it("deckt alle vier Sub-Stages aus dem stage-gate-Domain ab", () => {
    const keys = SUB_STAGE_RULES.map((r) => r.key).sort();
    expect(keys).toEqual([...SUB_STAGES].sort());
  });

  it("ordnet L2.x dem L2-Major-Gate zu, L4.x dem L4-Major-Gate", () => {
    for (const r of SUB_STAGE_RULES) {
      if (r.key.startsWith("L2")) expect(r.gate).toBe("L2");
      if (r.key.startsWith("L4")) expect(r.gate).toBe("L4");
    }
  });
});
