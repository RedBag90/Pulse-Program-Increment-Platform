import { describe, it, expect } from "vitest";
import {
  artPotAccessDeniedReason,
  mayDistributeToEpic,
  rtbManageDeniedReason,
  artBudgetReadDeniedReason,
  readAllowedWithoutProductManagerCheck,
  valueStreamBudgetReadDeniedReason,
  maySeeValueStreamTotals,
  type ArtPotAccessFacts,
  type ValueStreamBudgetReadFacts,
} from "@/modules/budgeting/domain/budget-access";

const nobody: ArtPotAccessFacts = {
  isValueStreamFinance: false,
  isEpicSolutionProductManager: false,
  hasRtbCapability: false,
  hasArtDistributeCapability: false,
};

describe("artPotAccessDeniedReason", () => {
  it("lässt die Capability-Träger durch", () => {
    expect(artPotAccessDeniedReason({ ...nobody, hasRtbCapability: true })).toBeNull();
  });

  it("lässt die Finance-Partei des Wertstroms durch — ohne Rolle", () => {
    expect(artPotAccessDeniedReason({ ...nobody, isValueStreamFinance: true })).toBeNull();
  });

  it("lässt den Produkt-Manager der Solution dieses Epics durch", () => {
    expect(artPotAccessDeniedReason({ ...nobody, isEpicSolutionProductManager: true })).toBeNull();
  });

  it("lässt den RTE dieses ARTs durch — sein Recht hängt am ART", () => {
    expect(artPotAccessDeniedReason({ ...nobody, hasArtDistributeCapability: true })).toBeNull();
  });

  it("weist ab, wer keines von vieren ist — und nennt den Grund", () => {
    const reason = artPotAccessDeniedReason(nobody);
    expect(reason).not.toBeNull();
    expect(reason).toContain("RTE");
    expect(reason).toContain("Produkt-Manager");
  });
});

describe("mayDistributeToEpic — die Zeile, nicht der Topf", () => {
  it("gilt für den Produkt-Manager nur bei seinem eigenen Epic", () => {
    // Dieselbe Person, zwei Zeilen derselben Fläche: die eine trägt seine
    // Solution, die andere eine fremde.
    expect(mayDistributeToEpic({ ...nobody, isEpicSolutionProductManager: true })).toBe(true);
    expect(mayDistributeToEpic({ ...nobody, isEpicSolutionProductManager: false })).toBe(false);
  });

  it("gilt für Finance und Capability-Träger unabhängig vom Epic", () => {
    for (const facts of [
      { ...nobody, isValueStreamFinance: true },
      { ...nobody, hasRtbCapability: true },
      // Der RTE seines ARTs: sein Recht gilt für jede Zeile, nicht nur für die
      // Epics einer bestimmten Solution.
      { ...nobody, hasArtDistributeCapability: true },
    ]) {
      expect(mayDistributeToEpic({ ...facts, isEpicSolutionProductManager: false })).toBe(true);
      expect(mayDistributeToEpic({ ...facts, isEpicSolutionProductManager: true })).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Die beiden Regeln, die bis hierhin keinen Test hatten
// ---------------------------------------------------------------------------

describe("rtbManageDeniedReason", () => {
  const niemand = { isValueStreamFinance: false, hasRtbCapability: false };

  it("lässt die Capability-Träger durch", () => {
    expect(rtbManageDeniedReason({ ...niemand, hasRtbCapability: true }, "items")).toBeNull();
  });

  it("lässt die Finance-Partei durch — ohne Rolle", () => {
    // Der zeilenabhängige Weg: `ValueStream.financeApproverId` lässt sich nicht
    // als Capability ausdrücken, deshalb steht er vor der RBAC-Prüfung.
    expect(rtbManageDeniedReason({ ...niemand, isValueStreamFinance: true }, "awards")).toBeNull();
  });

  it("nennt den Vorgang im Grund", () => {
    expect(rtbManageDeniedReason(niemand, "items")).toContain("Run-the-Business-Positionen");
    expect(rtbManageDeniedReason(niemand, "awards")).toContain("Zuspruch");
  });
});

describe("artBudgetReadDeniedReason", () => {
  const zugang = {
    budgetingEnabled: true,
    isValueStreamFinance: false,
    hasBudgetRead: false,
    hasArtDistributeCapability: false,
    isEpicSolutionProductManager: false,
  };

  it("weist ohne Modul-Lizenz ab, bevor irgendetwas anderes zählt", () => {
    const reason = artBudgetReadDeniedReason({
      ...zugang,
      budgetingEnabled: false,
      hasBudgetRead: true,
    });
    expect(reason).toContain("Modul");
  });

  it("lässt jeden der vier Wege durch", () => {
    for (const weg of [
      "isValueStreamFinance",
      "hasBudgetRead",
      "hasArtDistributeCapability",
      "isEpicSolutionProductManager",
    ] as const) {
      expect(artBudgetReadDeniedReason({ ...zugang, [weg]: true })).toBeNull();
    }
  });

  it("weist ab, wer keinen trägt", () => {
    expect(artBudgetReadDeniedReason(zugang)).not.toBeNull();
  });

  it("ist eine Obermenge der Verteiler — wer verteilen darf, darf sehen", () => {
    // Sonst ließe sich nicht verteilen: ohne den freien Betrag fehlt die
    // Grundlage der Entscheidung.
    expect(artBudgetReadDeniedReason({ ...zugang, hasArtDistributeCapability: true })).toBeNull();
    expect(
      artPotAccessDeniedReason({
        isValueStreamFinance: false,
        hasRtbCapability: false,
        hasArtDistributeCapability: true,
        isEpicSolutionProductManager: false,
      }),
    ).toBeNull();
  });
});

describe("readAllowedWithoutProductManagerCheck", () => {
  it("spart die teure Abfrage, wenn ein billiger Weg greift", () => {
    expect(
      readAllowedWithoutProductManagerCheck({
        budgetingEnabled: true,
        isValueStreamFinance: true,
        hasBudgetRead: false,
        hasArtDistributeCapability: false,
      }),
    ).toBe(true);
  });

  it("verlangt sie, wenn keiner greift", () => {
    expect(
      readAllowedWithoutProductManagerCheck({
        budgetingEnabled: true,
        isValueStreamFinance: false,
        hasBudgetRead: false,
        hasArtDistributeCapability: false,
      }),
    ).toBe(false);
  });
});

/**
 * Die Wertstromfläche prüfte bis zu dieser Stufe **gar nichts** — kein Modul,
 * keine Capability, keinen Scope. Tragbar, solange sie nur Summen zeigte; mit
 * den ART-Inhalten darin stünde geschütztes Geld hinter einer offenen Tür.
 */
describe("valueStreamBudgetReadDeniedReason", () => {
  const facts = (over: Partial<ValueStreamBudgetReadFacts> = {}): ValueStreamBudgetReadFacts => ({
    budgetingEnabled: true,
    isValueStreamFinance: false,
    hasValueStreamBudgetRead: false,
    hasRtbCapability: false,
    visibleArtCount: 0,
    ...over,
  });

  it("verweigert ohne Modul, noch vor jeder Rolle", () => {
    const r = valueStreamBudgetReadDeniedReason(
      facts({ budgetingEnabled: false, isValueStreamFinance: true, visibleArtCount: 3 }),
    );
    expect(r).toContain("Budgeting-Modul");
  });

  it("lässt die drei Wertstrom-Wege durch", () => {
    for (const over of [
      { isValueStreamFinance: true },
      { hasValueStreamBudgetRead: true },
      { hasRtbCapability: true },
    ]) {
      expect(valueStreamBudgetReadDeniedReason(facts(over))).toBeNull();
    }
  });

  /**
   * **Der Weg, für den es die Regel gibt.** Ein RTE trägt kein Wertstrom-Recht,
   * seit die ART-Budgets hier aufklappen ist die Fläche aber sein Weg zu
   * seinem eigenen Geld.
   */
  it("lässt hinein, wer mindestens ein ART dieses Stroms sehen darf", () => {
    expect(valueStreamBudgetReadDeniedReason(facts({ visibleArtCount: 1 }))).toBeNull();
  });

  it("verweigert, wer weder den Strom noch eines seiner ARTs sehen darf", () => {
    const r = valueStreamBudgetReadDeniedReason(facts());
    expect(r).toContain("nicht zugänglich");
  });
});

describe("maySeeValueStreamTotals", () => {
  const facts = (over: Partial<ValueStreamBudgetReadFacts> = {}): ValueStreamBudgetReadFacts => ({
    budgetingEnabled: true,
    isValueStreamFinance: false,
    hasValueStreamBudgetRead: false,
    hasRtbCapability: false,
    visibleArtCount: 0,
    ...over,
  });

  /**
   * Die Trennung, auf die es ankommt: **hineinkommen** und **die Summen sehen**
   * sind zwei Fragen. Wer über ein ART hereinkommt, läse in Budgetplan, Verlauf
   * und Auslastung die Zahlen der anderen ARTs mit.
   */
  it("gibt die Summen nicht frei, nur weil ein ART sichtbar ist", () => {
    expect(maySeeValueStreamTotals(facts({ visibleArtCount: 5 }))).toBe(false);
    expect(valueStreamBudgetReadDeniedReason(facts({ visibleArtCount: 5 }))).toBeNull();
  });

  it("gibt sie frei, sobald das Wertstrom-Recht da ist", () => {
    expect(maySeeValueStreamTotals(facts({ hasValueStreamBudgetRead: true }))).toBe(true);
  });

  it("gibt ohne Modul nichts frei", () => {
    expect(
      maySeeValueStreamTotals(facts({ budgetingEnabled: false, isValueStreamFinance: true })),
    ).toBe(false);
  });
});
