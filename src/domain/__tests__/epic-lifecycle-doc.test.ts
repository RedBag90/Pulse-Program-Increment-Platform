import { describe, it, expect } from "vitest";
import {
  LIFECYCLE_TRIGGERS,
  SUB_STAGE_RULES,
  BUCKET_RULES,
  BLOCKED_MANUAL_TRANSITIONS,
  manualForwardBlockReason,
  type ManualAdvanceState,
} from "@/domain/epic-lifecycle-doc";
import { SUB_STAGES } from "@/domain/stage-gate";

/**
 * Sanity-Checks der Lebenszyklus-Dokumentations-Konstanten. Falls ein
 * Auto-Advance-Trigger im Code ergaenzt/entfernt wird, soll auch hier
 * der Eintrag mitgepflegt werden — diese Tests sind die Drift-Bremse.
 */

describe("LIFECYCLE_TRIGGERS", () => {
  it("deckt alle 5 Auto-Advance-Trigger des Reifegrad-Modells ab", () => {
    const transitions = LIFECYCLE_TRIGGERS.map((t) => `${t.stageFrom}->${t.stageTo}`).sort();
    expect(transitions).toEqual(["L0->L1", "L1->L2", "L2->L3", "L3->L4", "L4->L5"]);
  });

  it("annotiert die Sub-Stages, die direkt aus dem Stage-Advance entstehen", () => {
    const l2Advance = LIFECYCLE_TRIGGERS.find((t) => t.stageTo === "L2");
    const l4Advance = LIFECYCLE_TRIGGERS.find((t) => t.stageTo === "L4");
    expect(l2Advance?.subStageAfter).toBe("L2.1");
    expect(l4Advance?.subStageAfter).toBe("L4.1");
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

describe("BUCKET_RULES", () => {
  it("definiert die zwei Bucket-Override-Regeln (L0+owner, L2+bcApproved)", () => {
    const overrides = BUCKET_RULES.filter((r) => r.stageGate !== r.bucket);
    expect(overrides.length).toBe(2);
    expect(overrides).toContainEqual(expect.objectContaining({ stageGate: "L0", bucket: "L1" }));
    expect(overrides).toContainEqual(expect.objectContaining({ stageGate: "L2", bucket: "L3" }));
  });

  it("liefert fuer jedes Stage-Gate mindestens eine Default-Regel (Bucket == Stage)", () => {
    const stageGates = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
    for (const g of stageGates) {
      const defaultRule = BUCKET_RULES.find((r) => r.stageGate === g && r.bucket === g);
      expect(defaultRule, `Default-Regel fuer ${g} fehlt`).toBeTruthy();
    }
  });
});

describe("BLOCKED_MANUAL_TRANSITIONS", () => {
  it("sperrt genau L2->L3 und L4->L5", () => {
    const transitions = BLOCKED_MANUAL_TRANSITIONS.map((b) => `${b.from}->${b.to}`).sort();
    expect(transitions).toEqual(["L2->L3", "L4->L5"]);
  });

  it("erklaert je den automatischen Pfad in der reason", () => {
    const l2 = BLOCKED_MANUAL_TRANSITIONS.find((b) => b.from === "L2");
    const l4 = BLOCKED_MANUAL_TRANSITIONS.find((b) => b.from === "L4");
    expect(l2?.reason).toMatch(/budget/i);
    expect(l4?.reason).toMatch(/impact/i);
  });
});

describe("manualForwardBlockReason", () => {
  const base: ManualAdvanceState = {
    multiPartyApproval: true,
    hypothesisApprovedAt: null,
    hasHypothesisContent: false,
    hasBusinessCaseContent: false,
    startedChildFeatureCount: 0,
  };

  it("L0→L1 (Approval an): blockt ohne freigegebene Hypothese, erlaubt mit", () => {
    expect(manualForwardBlockReason("L0", "L1", base)).toMatch(/Hypothese/i);
    expect(
      manualForwardBlockReason("L0", "L1", { ...base, hypothesisApprovedAt: new Date() }),
    ).toBeNull();
  });

  it("L0→L1 (Approval aus): blockt ohne Hypothese-Inhalt, erlaubt mit", () => {
    expect(manualForwardBlockReason("L0", "L1", { ...base, multiPartyApproval: false })).toMatch(
      /Hypothese/i,
    );
    expect(
      manualForwardBlockReason("L0", "L1", {
        ...base,
        multiPartyApproval: false,
        hasHypothesisContent: true,
      }),
    ).toBeNull();
  });

  it("L1→L2: blockt ohne Business-Case-Inhalt, erlaubt mit", () => {
    expect(manualForwardBlockReason("L1", "L2", base)).toMatch(/Business Case/i);
    expect(
      manualForwardBlockReason("L1", "L2", { ...base, hasBusinessCaseContent: true }),
    ).toBeNull();
  });

  it("L3→L4: blockt ohne gestartetes Feature, erlaubt mit ≥1", () => {
    expect(manualForwardBlockReason("L3", "L4", base)).toMatch(/Feature/i);
    expect(
      manualForwardBlockReason("L3", "L4", { ...base, startedChildFeatureCount: 1 }),
    ).toBeNull();
  });

  it("Rückwärts-Wechsel sind erlaubt (kein Guard)", () => {
    expect(manualForwardBlockReason("L1", "L0", base)).toBeNull();
    expect(manualForwardBlockReason("L2", "L1", base)).toBeNull();
    expect(manualForwardBlockReason("L4", "L3", base)).toBeNull();
  });
});
